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
  const similarities = examples.map((example) => {
    const jaccard = jaccardSimilarity(input, example)
    const shortInputCoverage = inputCoverage(input, example)
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

function structuralThreadScore(input: string, thread: InterviewThread): CueScore {
  if (thread.id !== 'entscheidung') return { score: 0, matches: [] }

  const normalized = normalizeText(input)
  if (!/^(sollen|sollten) wir\b/.test(normalized) || !/\boder\b/.test(normalized)) {
    return { score: 0, matches: [] }
  }

  const [left, ...rightParts] = normalized.split(/\boder\b/)
  const leftOption = left.replace(/^(sollen|sollten) wir\s+/, '')
  const rightOption = rightParts.join(' oder ')

  if (!hasConcreteChoiceSide(leftOption) || !hasConcreteChoiceSide(rightOption)) {
    return { score: 0, matches: [] }
  }

  return { score: 6, matches: ['Auswahl zwischen zwei benannten Optionen'] }
}

function rankVariant(input: string, variant: ThreadVariant): VariantScore {
  const positive = scoreCues(input, variant.cues)
  const negative = scoreAntiCues(input, variant.antiCues)
  const examples = exampleScore(input, variant.examples)
  const reference = `${variant.name} ${variant.description} ${variant.steps.join(' ')}`
  const score = Math.max(0, positive.score - negative + examples.score + referenceTokenScore(input, reference))

  return {
    variant,
    score,
    matches: positive.matches,
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
