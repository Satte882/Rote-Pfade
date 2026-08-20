import type { ExportPayload, FeedbackEntry, TrainingStats } from '../types/thread'

const FEEDBACK_KEY = 'rote-pfade.feedback.v1'
const TRAINING_KEY = 'rote-pfade.training.v1'

const emptyStats = (): TrainingStats => ({
  answered: 0,
  correct: 0,
  byThread: {},
  leverAnswered: 0,
  leverCorrect: 0,
  byLever: {},
})

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function normalizeTrainingStats(value: Partial<TrainingStats> | null | undefined): TrainingStats {
  if (!value) return emptyStats()
  return {
    answered: asNonNegativeNumber(value.answered),
    correct: asNonNegativeNumber(value.correct),
    byThread: value.byThread && typeof value.byThread === 'object' ? value.byThread : {},
    leverAnswered: asNonNegativeNumber(value.leverAnswered),
    leverCorrect: asNonNegativeNumber(value.leverCorrect),
    byLever: value.byLever && typeof value.byLever === 'object' ? value.byLever : {},
  }
}

function normalizeFeedbackKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function loadFeedback(): FeedbackEntry[] {
  if (!hasLocalStorage()) return []
  return safeParse<FeedbackEntry[]>(localStorage.getItem(FEEDBACK_KEY), [])
}

export function findFeedbackOverride(question: string): FeedbackEntry | undefined {
  const key = normalizeFeedbackKey(question)
  if (!key) return undefined
  return loadFeedback().find((entry) => normalizeFeedbackKey(entry.question) === key)
}

export function saveFeedback(entry: FeedbackEntry): FeedbackEntry[] {
  const next = [entry, ...loadFeedback()].slice(0, 1000)
  if (hasLocalStorage()) localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next))
  return next
}

export function loadTrainingStats(): TrainingStats {
  if (!hasLocalStorage()) return emptyStats()
  const parsed = safeParse<Partial<TrainingStats>>(localStorage.getItem(TRAINING_KEY), {})
  return normalizeTrainingStats(parsed)
}

export function saveThreadTrainingAnswer(threadId: string, correct: boolean): TrainingStats {
  const current = loadTrainingStats()
  const threadStats = current.byThread[threadId] ?? { answered: 0, correct: 0 }
  const next: TrainingStats = {
    ...current,
    answered: current.answered + 1,
    correct: current.correct + (correct ? 1 : 0),
    byThread: {
      ...current.byThread,
      [threadId]: {
        answered: threadStats.answered + 1,
        correct: threadStats.correct + (correct ? 1 : 0),
      },
    },
  }
  if (hasLocalStorage()) localStorage.setItem(TRAINING_KEY, JSON.stringify(next))
  return next
}

export function saveLeverTrainingAnswer(leverId: string, correct: boolean): TrainingStats {
  const current = loadTrainingStats()
  const leverStats = current.byLever[leverId] ?? { answered: 0, correct: 0 }
  const next: TrainingStats = {
    ...current,
    leverAnswered: current.leverAnswered + 1,
    leverCorrect: current.leverCorrect + (correct ? 1 : 0),
    byLever: {
      ...current.byLever,
      [leverId]: {
        answered: leverStats.answered + 1,
        correct: leverStats.correct + (correct ? 1 : 0),
      },
    },
  }
  if (hasLocalStorage()) localStorage.setItem(TRAINING_KEY, JSON.stringify(next))
  return next
}

export function saveTrainingAnswer(threadId: string, correct: boolean): TrainingStats {
  return saveThreadTrainingAnswer(threadId, correct)
}

export function createExportPayload(): ExportPayload {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    feedback: loadFeedback(),
    trainingStats: loadTrainingStats(),
  }
}

export function downloadExport(): void {
  const payload = createExportPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `rote-pfade-daten-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function importExport(file: File): Promise<ExportPayload> {
  const content = await file.text()
  const parsed = JSON.parse(content) as Partial<ExportPayload>

  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.feedback) || !parsed.trainingStats) {
    throw new Error('Die Datei hat kein gültiges Rote-Pfade-Exportformat.')
  }

  if (!hasLocalStorage()) throw new Error('Lokaler Browserspeicher ist nicht verfügbar.')
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(parsed.feedback))
  localStorage.setItem(TRAINING_KEY, JSON.stringify(normalizeTrainingStats(parsed.trainingStats)))
  return {
    schemaVersion: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    feedback: parsed.feedback,
    trainingStats: normalizeTrainingStats(parsed.trainingStats),
  }
}

export function clearLocalData(): void {
  if (!hasLocalStorage()) return
  localStorage.removeItem(FEEDBACK_KEY)
  localStorage.removeItem(TRAINING_KEY)
}
