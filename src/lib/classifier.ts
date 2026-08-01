import type { ClassificationResult, InterviewThread, RankedThread } from '../types/thread'
import { extractTopic, jaccardSimilarity, normalizeText, tokenize } from './text'

const threadModules = import.meta.glob('../data/threads/*.json', { eager: true, import: 'default' })

export const threads = Object.values(threadModules) as InterviewThread[]

const tokenOverlapScore = (input: string, thread: InterviewThread): number => {
  const inputTokens = new Set(tokenize(input))
  const referenceTokens = new Set(
    tokenize(`${thread.name} ${thread.description} ${thread.purpose} ${thread.steps.join(' ')}`),
  )

  let matches = 0
  inputTokens.forEach((token) => {
    if (referenceTokens.has(token)) matches += 1
  })

  return matches * 0.45
}

function rankThread(input: string, thread: InterviewThread): Omit<RankedThread, 'matchPercent'> {
  const normalizedInput = normalizeText(input)
  const matchedCues: string[] = []
  let rawScore = 0

  thread.cues.forEach((cue) => {
    const normalizedCue = normalizeText(cue.text)
    if (normalizedInput.includes(normalizedCue)) {
      rawScore += cue.weight
      matchedCues.push(cue.text)
      return
    }

    const similarity = jaccardSimilarity(normalizedInput, normalizedCue)
    if (similarity >= 0.66) {
      rawScore += cue.weight * similarity * 0.7
      matchedCues.push(cue.text)
    }
  })

  thread.antiCues.forEach((cue) => {
    const normalizedCue = normalizeText(cue.text)
    if (normalizedInput.includes(normalizedCue)) rawScore -= cue.weight
  })

  const exampleSimilarity = Math.max(
    ...thread.examples.map((example) => jaccardSimilarity(input, example)),
    0,
  )
  rawScore += exampleSimilarity * 8
  rawScore += tokenOverlapScore(input, thread)

  return {
    thread,
    rawScore: Math.max(rawScore, 0),
    matchedCues: [...new Set(matchedCues)].slice(0, 4),
    exampleSimilarity,
  }
}

function toMatchPercent(score: number, topScore: number, totalTopScores: number): number {
  if (topScore <= 0) return 18
  const relative = score / topScore
  const dominance = totalTopScores > 0 ? score / totalTopScores : 0
  const percent = 26 + relative * 42 + dominance * 28
  return Math.max(12, Math.min(96, Math.round(percent)))
}

export function classifyQuestion(input: string): ClassificationResult {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Bitte gib eine Interviewfrage oder ein Satzfragment ein.')

  const rankedBase = threads
    .map((thread) => rankThread(trimmed, thread))
    .sort((left, right) => right.rawScore - left.rawScore)

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
    matchPercent: fallback && index === 0
      ? 28
      : toMatchPercent(item.rawScore, topScore, totalTopScores),
  }))

  return {
    input: trimmed,
    topic: extractTopic(trimmed),
    primary: ranked[0],
    alternatives: ranked.slice(1, 3),
  }
}

export function getThreadById(id: string): InterviewThread | undefined {
  return threads.find((thread) => thread.id === id)
}
