import { useRef, useState } from 'react'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { classifyQuestion, getResolvedName, getResolvedSteps, threads } from '../lib/classifier'
import { saveFeedback } from '../lib/storage'
import type { ClassificationResult, FeedbackEntry } from '../types/thread'
import type { CachePersistence, CacheState, SpeechProfile } from '../types/speech'

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

function profileLabel(profile: SpeechProfile | null): string {
  if (profile === 'quality-fp16-q8') return 'Base · FP16/q8'
  if (profile === 'balanced-q8') return 'Base · q8/q8'
  if (profile === 'cpu-tiny-q8') return 'Tiny · CPU q8'
  return 'noch nicht geladen'
}

function cacheLabel(state: CacheState, persistence: CachePersistence): string {
  if (state === 'unsupported') return 'Cache API nicht verfügbar'
  if (state === 'unreliable') return 'wiederholt geleert'
  if (state === 'present') return persistence === 'persistent' ? 'vorhanden · persistent' : 'vorhanden · Best Effort'
  if (state === 'empty') return 'noch leer'
  return 'wird geprüft'
}

function formatMilliseconds(value: number): string {
  if (value < 1_000) return `${value} ms`
  return `${(value / 1_000).toFixed(1).replace('.', ',')} s`
}

function MicrophoneIcon({ recording }: { recording: boolean }) {
  if (recording) {
    return <span className="stop-symbol" aria-hidden="true" />
  }

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
  const processing = [
    'requesting-permission',
    'finishing-recording',
    'preparing-audio',
    'loading-model',
    'transcribing',
    'discarded',
  ].includes(voice.phase)
  const diagnosticsVisible = Boolean(
    voice.diagnostics.profile
    || voice.diagnostics.timings
    || voice.diagnostics.audioQuality
    || voice.diagnostics.cacheState !== 'unknown',
  )

  const handleMicrophone = () => {
    if (recording) {
      void voice.stopAndTranscribe()
      focusInput()
      return
    }
    if (!processing) {
      void voice.startRecording().then(focusInput)
    }
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
            aria-label={recording ? 'Aufnahme beenden und transkribieren' : 'Sprachaufnahme starten'}
            title={voice.supported ? 'Frage sprechen' : 'Sprachaufnahme wird von diesem Browser nicht unterstützt'}
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

        {diagnosticsVisible && (
          <details className="speech-diagnostics">
            <summary>Sprachdiagnose</summary>
            <dl>
              <div><dt>Profil</dt><dd>{profileLabel(voice.diagnostics.profile)}</dd></div>
              <div><dt>Cache</dt><dd>{cacheLabel(voice.diagnostics.cacheState, voice.diagnostics.cachePersistence)}</dd></div>
              {voice.diagnostics.timings && (
                <>
                  <div><dt>Nach Enter</dt><dd>{formatMilliseconds(voice.diagnostics.timings.totalAfterEnterMs)}</dd></div>
                  <div><dt>Audio</dt><dd>{formatMilliseconds(voice.diagnostics.timings.audioPreparationMs)}</dd></div>
                  <div><dt>Modell warten</dt><dd>{formatMilliseconds(voice.diagnostics.timings.modelWaitMs)}</dd></div>
                  <div><dt>Inferenz</dt><dd>{formatMilliseconds(voice.diagnostics.timings.inferenceMs)}</dd></div>
                  <div><dt>Echtzeitfaktor</dt><dd>{voice.diagnostics.timings.realtimeFactor.toFixed(2).replace('.', ',')}×</dd></div>
                </>
              )}
              {voice.diagnostics.audioQuality && (
                <>
                  <div><dt>Audioqualität</dt><dd>{voice.diagnostics.audioQuality.level === 'good' ? 'geeignet' : voice.diagnostics.audioQuality.level === 'warning' ? 'eingeschränkt' : 'ungeeignet'}</dd></div>
                  <div><dt>Pegel</dt><dd>{voice.diagnostics.audioQuality.rmsDbfs} dBFS</dd></div>
                </>
              )}
            </dl>

            {voice.diagnostics.audioQuality?.warnings.map((warning) => (
              <p className="speech-diagnostic-warning" key={warning}>{warning}</p>
            ))}
            {voice.diagnostics.cacheState === 'unreliable' && (
              <p className="speech-diagnostic-warning">
                Der Browser hat den Modellcache wiederholt geleert. Die Website als App installieren oder diese Website vom automatischen Löschen der Websitedaten ausnehmen.
              </p>
            )}
            {voice.diagnostics.performanceRecommendation === 'balanced-q8' && voice.preferredProfile !== 'balanced-q8' && (
              <div className="speech-recommendation">
                <p>FP16/q8 war bei mindestens zwei geeigneten Folgeaufnahmen deutlich langsamer als Echtzeit.</p>
                <button type="button" onClick={() => voice.setPreferredProfile('balanced-q8')}>q8/q8 testen</button>
              </div>
            )}
            {voice.preferredProfile === 'balanced-q8' && (
              <button className="speech-profile-reset" type="button" onClick={() => voice.setPreferredProfile('quality-fp16-q8')}>
                Zurück zu FP16/q8
              </button>
            )}
          </details>
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
