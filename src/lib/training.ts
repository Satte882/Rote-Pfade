import { managementLevers, managementTrainingCases } from '../data/management-training'
import type { InterviewThread, ManagementLever, ThreadVariant } from '../types/thread'

export type TrainingQuestion = {
  prompt: string
  correctThread: InterviewThread
  correctVariant?: ThreadVariant
  correctLever: ManagementLever
  options: InterviewThread[]
  leverOptions: ManagementLever[]
  rationale: string
}

function shuffle<T>(values: T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5)
}

export function createTrainingQuestion(
  threads: InterviewThread[],
  previousPrompt?: string,
): TrainingQuestion {
  const candidates = managementTrainingCases.map((trainingCase) => {
    const thread = threads.find((item) => item.id === trainingCase.threadId)
    if (!thread) {
      throw new Error(`Unbekannter roter Faden im Management-Training: ${trainingCase.threadId}`)
    }

    const lever = managementLevers.find((item) => item.id === trainingCase.leverId)
    if (!lever) {
      throw new Error(`Unbekannter Management-Hebel im Training: ${trainingCase.leverId}`)
    }

    const variant = trainingCase.variantId
      ? thread.variants?.find((item) => item.id === trainingCase.variantId)
      : undefined
    if (trainingCase.variantId && !variant) {
      throw new Error(`Unbekannte Variante im Management-Training: ${trainingCase.variantId}`)
    }

    return { trainingCase, thread, variant, lever }
  })

  const filtered = candidates.filter((candidate) => candidate.trainingCase.prompt !== previousPrompt)
  const pool = filtered.length > 0 ? filtered : candidates
  const selected = pool[Math.floor(Math.random() * pool.length)]

  const related = selected.thread.relatedIds
    .map((id) => threads.find((thread) => thread.id === id))
    .filter((thread): thread is InterviewThread => Boolean(thread))
  const otherThreads = shuffle(
    threads.filter(
      (thread) => thread.id !== selected.thread.id && !related.some((item) => item.id === thread.id),
    ),
  )
  const threadDistractors = shuffle([...related, ...otherThreads]).slice(0, 3)
  const leverDistractors = shuffle(
    managementLevers.filter((lever) => lever.id !== selected.lever.id),
  ).slice(0, 3)

  return {
    prompt: selected.trainingCase.prompt,
    correctThread: selected.thread,
    correctVariant: selected.variant,
    correctLever: selected.lever,
    options: shuffle([selected.thread, ...threadDistractors]),
    leverOptions: shuffle([selected.lever, ...leverDistractors]),
    rationale: selected.trainingCase.rationale,
  }
}
