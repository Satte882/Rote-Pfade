export type Cue = {
  text: string
  weight: number
}

export type ThreadVariant = {
  id: string
  name: string
  description: string
  steps: string[]
  stepPrompts: string[]
  cues: Cue[]
  antiCues: Cue[]
  examples: string[]
  mnemonic?: string
  opening?: string
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
  variants?: ThreadVariant[]
}

export type RankedThread = {
  thread: InterviewThread
  selectedVariant?: ThreadVariant
  rawScore: number
  matchPercent: number
  matchedCues: string[]
  exampleSimilarity: number
}

export type ClassificationEvidence = 'clear' | 'ambiguous' | 'weak'

export type ClassificationResult = {
  input: string
  topic: string
  primary: RankedThread
  alternatives: RankedThread[]
  evidence: ClassificationEvidence
  overrideApplied: boolean
}

export type FeedbackEntry = {
  id: string
  question: string
  predictedThreadId: string
  predictedVariantId?: string
  selectedThreadId: string
  selectedVariantId?: string
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
