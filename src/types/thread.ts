export type Cue = {
  text: string
  weight: number
}

export type InterviewThread = {
  id: string
  name: string
  shortName: string
  category: string
  purpose: string
  description: string
  steps: string[]
  stepPrompts: string[]
  mnemonic: string
  cues: Cue[]
  antiCues: Cue[]
  examples: string[]
  opening: string
  relatedIds: string[]
}

export type RankedThread = {
  thread: InterviewThread
  rawScore: number
  matchPercent: number
  matchedCues: string[]
  exampleSimilarity: number
}

export type ClassificationResult = {
  input: string
  topic: string
  primary: RankedThread
  alternatives: RankedThread[]
}

export type FeedbackEntry = {
  id: string
  question: string
  predictedThreadId: string
  selectedThreadId: string
  isCorrect: boolean
  createdAt: string
}

export type TrainingStats = {
  answered: number
  correct: number
  byThread: Record<string, { answered: number; correct: number }>
}

export type ExportPayload = {
  schemaVersion: 1
  exportedAt: string
  feedback: FeedbackEntry[]
  trainingStats: TrainingStats
}
