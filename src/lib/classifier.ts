import type {
  ClassificationEvidence,
  ClassificationResult,
  Cue,
  FeedbackEntry,
  InterviewThread,
  RankedThread,
  ThreadVariant,
} from '../types/thread'
import { loadFeedback } from './storage'
import { extractTopic, jaccardSimilarity, normalizeText, tokenize } from './text'

const threadModules = import.meta.glob('../data/threads/*.json', { eager: true, import: 'default' })

const THREAD_ORDER = [
  'vorgehen',
  'strategie-zielbild',
  'problem-stoerung',
  'entscheidung',
  'entscheidung-unsicherheit',
  'ki-eignung',
  'vergleich',
  'skalierung',
  'stakeholder-change',
  'stakeholder-konflikt',
  'risiko-governance',
  'wirkung',
  'priorisierung',
  'star-l',
]

const CHOICE_FILLER_TOKENS = new Set([
  'soll',
  'sollt',
  'nutz',
  'verwend',
  'einsetz',
  'wahl',
  'auswahl',
  'entscheid',
  'mach',
  'tun',
  'nicht',
])

const LOCAL_OPERATION_TERMS = [
  'lokal',
  'lokale llm',
  'on premise',
  'on prem',
  'self hosted',
  'self hosting',
  'selbst hosten',
  'selbst betreiben',
  'eigenbetrieb',
  'eigene infrastruktur',
]

const MANAGED_OPERATION_TERMS = [
  'cloud',
  'saas',
  'managed',
  'managed service',
  'hosted',
  'zukauf',
  'kaufen',
  'fremdbezug',
]

const PROVIDER_TOOL_TERMS = [
  'openai',
  'chatgpt',
  'claude',
  'anthropic',
  'gemini',
  'google gemini',
  'copilot',
  'microsoft copilot',
  'mistral',
  'le chat',
  'langdock',
  'meingpt',
  'mein gpt',
  'librechat',
  'open webui',
  'openrouter',
  'perplexity',
  'qwen',
  'kimi',
  'grok',
]

const COMPARISON_OPTION_TERMS = [
  'pilot',
  'mvp',
  'proof of concept',
  'poc',
  'agil',
  'klassisch',
]

const AI_OPTION_TERMS = [
  'ki',
  'künstliche intelligenz',
  'genai',
  'generative ai',
  'llm',
  'machine learning',
]

const NON_AI_ALTERNATIVE_TERMS = [
  'automatisierung',
  'klassische automatisierung',
  'regelbasiert',
  'rpa',
  'prozessverbesserung',
]

export const threads = (Object.values(threadModules) as InterviewThread[]).sort(
  (left, right) => THREAD_ORDER.indexOf(left.id) - THREAD_ORDER.indexOf(right.id),
)

type CueScore = {
  score: number
  matches: string[]
}

type VariantScore = {
  variant: ThreadVariant
  score: number
  matches: string[]
  exampleSimilarity: number
}

type ClassifyOptions = {
  feedback?: FeedbackEntry[]
}

type CompactChoiceRoute = 'entscheidung' | 'make-or-buy' | 'anbieterauswahl' | 'vergleich' | 'ki-eignung'

type CompactChoice = {
  left: string
  right: string
  route: CompactChoiceRoute
  explicitSeparator: boolean
}

function tokenCoverage(input: string, reference: string): number {
  const inputTokens = new Set(tokenize(input))
  const referenceTokens = [...new Set(tokenize(reference))]
  if (inputTokens.size === 0 || referenceTokens.length === 0) return 0
  const matches = referenceTokens.filter((token) => inputTokens.has(token)).length
  return matches / referenceTokens.length
}

function inputCoverage(input: string, reference: string): number {
  const inputTokens = [...new Set(tokenize(input))]
  const referenceTokens = new Set(tokenize(reference))
  if (inputTokens.length === 0 || referenceTokens.size === 0) return 0
  const matches = inputTokens.filter((token) => referenceTokens.has(token)).length
  return matches / inputTokens.length
}

function scoreCues(input: string, cues: Cue[]): CueScore {
  const normalizedInput = normalizeText(input)
  const matches: string[] = []
  let score = 0

  cues.forEach((cue) => {
    const normalizedCue = normalizeText(cue.text)
    let factor = 0

    if (normalizedInput.includes(normalizedCue)) {
      factor = 1
    } else {
      const cueTokens = tokenize(cue.text)
      const coverage = tokenCoverage(input, cue.text)
      const similarity = jaccardSimilarity(input, cue.text)

      if (cueTokens.length >= 2 && coverage >= 0.75) factor = Math.max(factor, coverage * 0.78)
      if (cueTokens.length === 1 && coverage === 1) factor = Math.max(factor, 0.58)
      if (similarity >= 0.5) factor = Math.max(factor, similarity * 0.68)
    }

    if (factor > 0) {
      score += cue.weight * factor
      matches.push(cue.text)
    }
  })

  return { score, matches }
}

function scoreAntiCues(input: string, cues: Cue[]): number {
  return scoreCues(input, cues).score
}

function exampleScore(input: string, examples: string[]): { score: number; similarity: number } {
  const inputTokens = new Set(tokenize(input))
  const similarities = examples.map((example) => {
    const exampleTokens = new Set(tokenize(example))
    const sharedTokenCount = [...inputTokens].filter((token) => exampleTokens.has(token)).length
    const jaccard = jaccardSimilarity(input, example)
    const shortInputCoverage = sharedTokenCount >= 2 ? inputCoverage(input, example) : 0
    return Math.max(jaccard, shortInputCoverage * 0.78)
  })
  const similarity = Math.max(...similarities, 0)
  return { score: similarity * 7, similarity }
}

function referenceTokenScore(input: string, reference: string): number {
  const inputTokens = [...new Set(tokenize(input))]
  const referenceTokens = new Set(tokenize(reference))
  if (inputTokens.length === 0 || referenceTokens.size === 0) return 0

  const matches = inputTokens.filter((token) => referenceTokens.has(token)).length
  if (matches < 2) return 0

  const coverage = matches / inputTokens.length
  const cap = inputTokens.length <= 4 ? 1.8 : 1.2
  return Math.min(cap, coverage * cap)
}

function hasConcreteChoiceSide(value: string): boolean {
  return tokenize(value).some((token) => !CHOICE_FILLER_TOKENS.has(token))
}

function containsChoiceTerm(value: string, terms: string[]): boolean {
  const valueTokens = new Set(tokenize(value))
  if (valueTokens.size === 0) return false

  return terms.some((term) => {
    const termTokens = [...new Set(tokenize(term))]
    return termTokens.length > 0 && termTokens.every((token) => valueTokens.has(token))
  })
}

function classifyChoiceRoute(left: string, right: string): CompactChoiceRoute {
  const leftLocal = containsChoiceTerm(left, LOCAL_OPERATION_TERMS)
  const rightLocal = containsChoiceTerm(right, LOCAL_OPERATION_TERMS)
  const leftManaged = containsChoiceTerm(left, MANAGED_OPERATION_TERMS)
  const rightManaged = containsChoiceTerm(right, MANAGED_OPERATION_TERMS)
  const leftProvider = containsChoiceTerm(left, PROVIDER_TOOL_TERMS)
  const rightProvider = containsChoiceTerm(right, PROVIDER_TOOL_TERMS)
  const leftComparison = containsChoiceTerm(left, COMPARISON_OPTION_TERMS)
  const rightComparison = containsChoiceTerm(right, COMPARISON_OPTION_TERMS)
  const leftAi = containsChoiceTerm(left, AI_OPTION_TERMS)
  const rightAi = containsChoiceTerm(right, AI_OPTION_TERMS)
  const leftAlternative = containsChoiceTerm(left, NON_AI_ALTERNATIVE_TERMS)
  const rightAlternative = containsChoiceTerm(right, NON_AI_ALTERNATIVE_TERMS)

  if (leftComparison && rightComparison) return 'vergleich'

  if (
    (leftLocal && (rightManaged || rightProvider))
    || (rightLocal && (leftManaged || leftProvider))
  ) {
    return 'make-or-buy'
  }

  if (leftProvider && rightProvider) return 'anbieterauswahl'

  if ((leftAi && rightAlternative) || (rightAi && leftAlternative)) {
    return 'ki-eignung'
  }

  return 'entscheidung'
}

function splitExplicitChoice(input: string): [string, string] | undefined {
  const parts = input
    .trim()
    .split(/\s+(?:oder|vs\.?|versus)\s+|\s*\/\s*/i)
    .map((part) => normalizeText(part))
    .filter(Boolean)

  return parts.length === 2 ? [parts[0], parts[1]] : undefined
}

function detectKnownBareChoice(input: string): CompactChoice | undefined {
  const normalized = normalizeText(input)
  const words = normalized.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 6) return undefined

  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ')
    const right = words.slice(index).join(' ')
    const route = classifyChoiceRoute(left, right)

    if (route !== 'entscheidung') {
      return { left, right, route, explicitSeparator: false }
    }
  }

  return undefined
}

function detectCompactChoice(input: string): CompactChoice | undefined {
  const explicit = splitExplicitChoice(input)
  if (explicit) {
    const [left, right] = explicit
    if (!hasConcreteChoiceSide(left) || !hasConcreteChoiceSide(right)) return undefined
    return {
      left,
      right,
      route: classifyChoiceRoute(left, right),
      explicitSeparator: true,
    }
  }

  return detectKnownBareChoice(input)
}

function structuralThreadScore(input: string, thread: InterviewThread): CueScore {
  const choice = detectCompactChoice(input)
  if (!choice) return { score: 0, matches: [] }

  if (choice.route === 'vergleich' && thread.id === 'vergleich') {
    return { score: 6, matches: ['Kurzer Vergleich zweier benannter Ansätze'] }
  }

  if (choice.route === 'ki-eignung' && thread.id === 'ki-eignung') {
    return { score: 6, matches: ['KI gegenüber einer einfacheren Alternative'] }
  }

  if (
    thread.id === 'entscheidung'
    && ['entscheidung', 'make-or-buy', 'anbieterauswahl'].includes(choice.route)
  ) {
    return { score: 6, matches: ['Auswahl zwischen zwei benannten Optionen'] }
  }

  return { score: 0, matches: [] }
}

function structuralVariantScore(input: string, variant: ThreadVariant): CueScore {
  const choice = detectCompactChoice(input)
  if (!choice) return { score: 0, matches: [] }

  if (choice.route === 'make-or-buy' && variant.id === 'make-or-buy') {
    return { score: 7, matches: ['Managed, Cloud oder Anbieter gegenüber lokalem Betrieb'] }
  }

  if (choice.route === 'anbieterauswahl' && variant.id === 'anbieterauswahl') {
    return { score: 7, matches: ['Auswahl zwischen zwei Anbietern oder Tools'] }
  }

  return { score: 0, matches: [] }
}

function rankVariant(input: string, variant: ThreadVariant): VariantScore {
  const positive = scoreCues(input, variant.cues)
  const structural = structuralVariantScore(input, variant)
  const negative = scoreAntiCues(input, variant.antiCues)
  const examples = exampleScore(input, variant.examples)
  const reference = `${variant.name} ${variant.description} ${variant.steps.join(' ')}`
  const score = Math.max(
    0,
    positive.score + structural.score - negative + examples.score + referenceTokenScore(input, reference),
  )

  return {
    variant,
    score,
    matches: [...new Set([...positive.matches, ...structural.matches])],
    exampleSimilarity: examples.similarity,
  }
}

function selectVariant(input: string, thread: InterviewThread): VariantScore | undefined {
  if (!thread.variants?.length) return undefined
  const ranked = thread.variants
    .map((variant) => rankVariant(input, variant))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best || best.score < 2.2) return undefined
  return best
}

function rankThread(input: string, thread: InterviewThread): Omit<RankedThread, 'matchPercent'> {
  const positive = scoreCues(input, thread.cues)
  const structural = structuralThreadScore(input, thread)
  const negative = scoreAntiCues(input, thread.antiCues)
  const examples = exampleScore(input, thread.examples)
  const reference = `${thread.name} ${thread.description} ${thread.purpose} ${thread.steps.join(' ')}`
  const selectedVariant = selectVariant(input, thread)
  const variantContribution = selectedVariant ? Math.min(4, selectedVariant.score * 0.38) : 0
  const rawScore = Math.max(
    0,
    positive.score
      + structural.score
      - negative
      + examples.score
      + referenceTokenScore(input, reference)
      + variantContribution,
  )

  return {
    thread,
    selectedVariant: selectedVariant?.variant,
    rawScore,
    matchedCues: [...new Set([
      ...positive.matches,
      ...structural.matches,
      ...(selectedVariant?.matches ?? []),
    ])].slice(0, 6),
    exampleSimilarity: Math.max(examples.similarity, selectedVariant?.exampleSimilarity ?? 0),
  }
}

function toMatchPercent(score: number, topScore: number, totalTopScores: number): number {
  if (topScore <= 0) return 18
  const relative = score / topScore
  const dominance = totalTopScores > 0 ? score / totalTopScores : 0
  const percent = 26 + relative * 42 + dominance * 28
  return Math.max(12, Math.min(96, Math.round(percent)))
}

function normalizedKey(value: string): string {
  return normalizeText(value)
}

function findOverride(input: string, feedback: FeedbackEntry[]): FeedbackEntry | undefined {
  const key = normalizedKey(input)
  return feedback.find((entry) => normalizedKey(entry.question) === key)
}

function determineEvidence(ranked: RankedThread[], fallback: boolean, overrideApplied: boolean): ClassificationEvidence {
  if (overrideApplied) return 'clear'
  const first = ranked[0]
  const second = ranked[1]
  if (fallback || !first || first.rawScore < 2.2) return 'weak'
  if (second && second.rawScore > 0) {
    const delta = first.rawScore - second.rawScore
    if (delta <= Math.max(1.35, first.rawScore * 0.18)) return 'ambiguous'
  }
  return 'clear'
}

function applyOverride(
  ranked: Array<Omit<RankedThread, 'matchPercent'>>,
  override: FeedbackEntry | undefined,
): boolean {
  if (!override) return false
  const index = ranked.findIndex((item) => item.thread.id === override.selectedThreadId)
  if (index < 0) return false

  const [selected] = ranked.splice(index, 1)
  const selectedVariant = override.selectedVariantId
    ? selected.thread.variants?.find((variant) => variant.id === override.selectedVariantId)
    : undefined
  selected.selectedVariant = selectedVariant
  selected.rawScore = Math.max(12, (ranked[0]?.rawScore ?? 0) + 6)
  selected.matchedCues = ['lokal bestätigte Zuordnung']
  ranked.unshift(selected)
  return true
}

export function classifyQuestion(input: string, options: ClassifyOptions = {}): ClassificationResult {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Bitte gib eine Interviewfrage oder ein Satzfragment ein.')

  const rankedBase = threads
    .map((thread) => rankThread(trimmed, thread))
    .sort((left, right) => right.rawScore - left.rawScore)

  const feedback = options.feedback ?? loadFeedback()
  const overrideApplied = applyOverride(rankedBase, findOverride(trimmed, feedback))
  const fallback = rankedBase[0]?.rawScore === 0

  if (fallback) {
    const defaultIndex = rankedBase.findIndex((item) => item.thread.id === 'vorgehen')
    if (defaultIndex > 0) {
      const [defaultThread] = rankedBase.splice(defaultIndex, 1)
      rankedBase.unshift(defaultThread)
    }
  }

  const topScore = rankedBase[0]?.rawScore ?? 0
  const totalTopScores = rankedBase.slice(0, 3).reduce((sum, item) => sum + item.rawScore, 0)
  const ranked: RankedThread[] = rankedBase.map((item, index) => ({
    ...item,
    matchPercent: overrideApplied && index === 0
      ? 100
      : fallback && index === 0
        ? 28
        : toMatchPercent(item.rawScore, topScore, totalTopScores),
  }))

  return {
    input: trimmed,
    topic: extractTopic(trimmed),
    primary: ranked[0],
    alternatives: ranked.slice(1, 3),
    evidence: determineEvidence(ranked, fallback, overrideApplied),
    overrideApplied,
  }
}

export function getThreadById(id: string): InterviewThread | undefined {
  return threads.find((thread) => thread.id === id)
}

export function getResolvedSteps(result: RankedThread): string[] {
  return result.selectedVariant?.steps ?? result.thread.steps
}

export function getResolvedName(result: RankedThread): string {
  return result.selectedVariant
    ? `${result.thread.name} · ${result.selectedVariant.name}`
    : result.thread.name
}
