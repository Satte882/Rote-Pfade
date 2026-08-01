import { useRef, useState } from 'react'
import { classifyQuestion, threads } from '../lib/classifier'
import { saveFeedback } from '../lib/storage'
import type { ClassificationResult, FeedbackEntry } from '../types/thread'

function createFeedbackId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function AnalyzeView({ onFeedbackSaved }: { onFeedbackSaved: () => void }) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [error, setError] = useState('')
  const [correctionId, setCorrectionId] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const resizeInput = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`
  }

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus())

  const analyze = () => {
    try {
      const next = classifyQuestion(question)
      setResult(next)
      setError('')
      setCorrectionId('')
      setFeedbackMessage('')
      focusInput()
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : 'Analyse fehlgeschlagen.')
      focusInput()
    }
  }

  const clear = () => {
    setQuestion('')
    setResult(null)
    setError('')
    setCorrectionId('')
    setFeedbackMessage('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    focusInput()
  }

  const persistFeedback = () => {
    if (!result || !correctionId) return
    const entry: FeedbackEntry = {
      id: createFeedbackId(),
      question: result.input,
      predictedThreadId: result.primary.thread.id,
      selectedThreadId: correctionId,
      isCorrect: correctionId === result.primary.thread.id,
      createdAt: new Date().toISOString(),
    }
    saveFeedback(entry)
    setFeedbackMessage('Lokal gespeichert.')
    onFeedbackSaved()
    focusInput()
  }

  return (
    <section className="sidecar-view" aria-label="Roten Faden erkennen">
      <label className="compact-input-label" htmlFor="question">Frage eingeben · Enter</label>
      <textarea
        ref={inputRef}
        id="question"
        value={question}
        autoFocus
        rows={1}
        spellCheck
        onChange={(event) => {
          setQuestion(event.target.value)
          resizeInput(event.target)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            clear()
            return
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            analyze()
          }
        }}
      />

      {error && <p className="error-message" role="alert">{error}</p>}

      {result && (
        <section className="compact-result" aria-live="polite">
          <h1>{result.primary.thread.name}</h1>
          <div className="arrow-path">
            {result.primary.thread.steps.map((step) => (
              <div className="arrow-step" key={step}>
                <span aria-hidden="true">→</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>

          <details className="compact-details">
            <summary>Alternative / Zuordnung</summary>
            <div className="alternative-lines">
              {result.alternatives.map((alternative) => (
                <span key={alternative.thread.id}>→ {alternative.thread.shortName}</span>
              ))}
            </div>
            <label htmlFor="correction">Zuordnung korrigieren</label>
            <select
              id="correction"
              value={correctionId}
              onChange={(event) => setCorrectionId(event.target.value)}
            >
              <option value="">Faden auswählen</option>
              {threads.map((thread) => (
                <option value={thread.id} key={thread.id}>{thread.shortName}</option>
              ))}
            </select>
            <button type="button" onClick={persistFeedback} disabled={!correctionId}>Speichern</button>
            {feedbackMessage && <span className="success-message">{feedbackMessage}</span>}
          </details>
        </section>
      )}
    </section>
  )
}
