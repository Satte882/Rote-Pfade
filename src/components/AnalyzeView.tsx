import { useRef, useState } from 'react'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { classifyQuestion, getResolvedName, getResolvedSteps, threads } from '../lib/classifier'
import { saveFeedback } from '../lib/storage'
import type { ClassificationResult, FeedbackEntry } from '../types/thread'

function createFeedbackId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function encodeSelection(threadId: string, variantId?: string): string {
  return variantId ? `${threadId}::${variantId}` : threadId
}

function decodeSelection(value: string): { threadId: string; variantId?: string } {
  const [threadId, variantId] = value.split('::')
  return { threadId, variantId: variantId || undefined }
}

function evidenceLabel(result: ClassificationResult): string {
  if (result.overrideApplied) return 'Lokal bestätigte Zuordnung'
  if (result.evidence === 'ambiguous') return 'Mehrdeutige Zuordnung'
  if (result.evidence === 'weak') return 'Schwache Evidenz'
  return 'Alternative / Zuordnung'
}

function MicrophoneIcon({ recording }: { recording: boolean }) {
  if (recording) return <span className="stop-symbol" aria-hidden="true" />

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14.5a4 4 0 0 0 4-4v-4a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" />
      <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" />
    </svg>
  )
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

  const analyzeText = (value: string) => {
    try {
      const next = classifyQuestion(value)
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

  const voice = useVoiceInput((transcript) => {
    setQuestion(transcript)
    requestAnimationFrame(() => {
      if (inputRef.current) resizeInput(inputRef.current)
    })
    analyzeText(transcript)
  })

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
    const selection = decodeSelection(correctionId)
    const predictedVariantId = result.primary.selectedVariant?.id
    const entry: FeedbackEntry = {
      id: createFeedbackId(),
      question: result.input,
      predictedThreadId: result.primary.thread.id,
      predictedVariantId,
      selectedThreadId: selection.threadId,
      selectedVariantId: selection.variantId,
      isCorrect:
        selection.threadId === result.primary.thread.id
        && selection.variantId === predictedVariantId,
      createdAt: new Date().toISOString(),
    }
    saveFeedback(entry)
    setResult(classifyQuestion(result.input))
    setFeedbackMessage('Für diese Eingabe lokal gespeichert.')
    onFeedbackSaved()
    focusInput()
  }

  const recording = voice.phase === 'recording'
  const processing = ['checking-model', 'installing-model', 'stopping'].includes(voice.phase)

  const handleMicrophone = () => {
    if (recording) {
      void voice.stopAndTranscribe()
      focusInput()
      return
    }
    if (!processing) void voice.startRecording().then(focusInput)
  }

  return (
    <section className="sidecar-view" aria-label="Roten Faden erkennen">
      <div className="input-zone">
        <label className="compact-input-label" htmlFor="question">
          {recording ? 'Aufnahme läuft · Enter beendet' : 'Frage eingeben · Enter'}
        </label>
        <div className="voice-input-row">
          <button
            className={recording ? 'microphone-button recording' : 'microphone-button'}
            type="button"
            onClick={handleMicrophone}
            disabled={!voice.supported || (processing && !recording)}
            aria-label={recording ? 'Aufnahme beenden und lokal erkennen' : 'Lokale Sprachaufnahme starten'}
            title={voice.supported
              ? 'Frage lokal mit Edge erkennen'
              : 'Lokale Spracherkennung wird von diesem Browser nicht unterstützt'}
          >
            <MicrophoneIcon recording={recording} />
          </button>
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
                if (recording || processing) voice.discard()
                else clear()
                return
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (recording) {
                  void voice.stopAndTranscribe()
                  return
                }
                if (!processing) analyzeText(question)
              }
            }}
          />
        </div>

        {(voice.status || voice.error) && (
          <div className={voice.error ? 'speech-status error' : `speech-status phase-${voice.phase}`} role="status">
            <span aria-hidden="true" />
            <strong>{voice.error || voice.status}</strong>
          </div>
        )}

        {voice.diagnostics.engine === 'edge-local' && voice.diagnostics.recognitionMs !== null && (
          <p className="speech-native-note">
            Edge lokal · de-DE · {(voice.diagnostics.recognitionMs / 1_000).toFixed(1).replace('.', ',')} s nach Enter
          </p>
        )}

        {error && <p className="error-message" role="alert">{error}</p>}
      </div>

      {result && (
        <section className="compact-result" aria-live="polite">
          <h1>{getResolvedName(result.primary)}</h1>
          <ol className="numbered-path">
            {getResolvedSteps(result.primary).map((step, index) => (
              <li className="numbered-step" key={step}>
                <span aria-hidden="true">{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>

          <details className={`compact-details evidence-${result.evidence}`}>
            <summary>{evidenceLabel(result)}</summary>
            <ol className="alternative-lines">
              {result.alternatives.map((alternative) => (
                <li key={alternative.thread.id}>{getResolvedName(alternative)}</li>
              ))}
            </ol>
            <label htmlFor="correction">Zuordnung oder Variante korrigieren</label>
            <select
              id="correction"
              value={correctionId}
              onChange={(event) => setCorrectionId(event.target.value)}
            >
              <option value="">Faden auswählen</option>
              {threads.map((thread) => (
                <optgroup label={thread.shortName} key={thread.id}>
                  <option value={encodeSelection(thread.id)}>{thread.shortName} · allgemein</option>
                  {thread.variants?.map((variant) => (
                    <option value={encodeSelection(thread.id, variant.id)} key={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </optgroup>
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
