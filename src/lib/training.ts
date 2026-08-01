import type { InterviewThread, ThreadVariant } from '../types/thread'

export type TrainingQuestion = {
  prompt: string
  correctThread: InterviewThread
  correctVariant?: ThreadVariant
  options: InterviewThread[]
}

function shuffle<T>(values: T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5)
}

export function createTrainingQuestion(
  threads: InterviewThread[],
  previousPrompt?: string,
): TrainingQuestion {
  const candidates = threads.flatMap((thread) => [
    ...thread.examples.map((prompt) => ({ prompt, thread, variant: undefined })),
    ...(thread.variants?.flatMap((variant) =>
      variant.examples.map((prompt) => ({ prompt, thread, variant })),
    ) ?? []),
  ])
  const filtered = candidates.filter((candidate) => candidate.prompt !== previousPrompt)
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
  const distractors = shuffle([...related, ...otherThreads]).slice(0, 3)

  return {
    prompt: selected.prompt,
    correctThread: selected.thread,
    correctVariant: selected.variant,
    options: shuffle([selected.thread, ...distractors]),
  }
}
