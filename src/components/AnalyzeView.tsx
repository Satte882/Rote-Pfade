import { useMemo, useState } from 'react'
import { classifyQuestion, threads } from '../lib/classifier'
import { interpolate } from '../lib/text'
import { saveFeedback } from '../lib/storage'
import type { ClassificationResult, FeedbackEntry, RankedThread } from '../types/thread'

const EXAMPLES = [
  'Fachbereich will einen KI-Chatbot, aber die IT blockiert wegen Datenschutz.',
  'Wie entscheiden Sie über den Pilot, obwohl noch wichtige Nutzungsdaten fehlen?',
  'Der technisch erfolgreiche Pilot wird von den Mitarbeitern kaum genutzt.',
  'Was ist der Unterschied zwischen Proof of Concept, Pilot und MVP?',
]

function createFeedbackId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function MatchBar({ result }: { result: RankedThread }) {
  return (
    <div className="match-bar" aria-label={`Heuristischer Matchwert ${result.matchPercent} Prozent`}>
      <div className="match-track">
        <div className="match-fill" style={{ width: `${result.matchPercent}%` }} />
      </div>
      <span>{result.matchPercent}%</span>
    </div>
  )
}

export function AnalyzeView({ onFeedbackSaved }: { onFeedbackSaved: () => void }) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [error, setError] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')

  const correctionOptions = useMemo(() => {
    const query = libraryQuery.trim().toLocaleLowerCase('de-DE')
    if (!query) return threads
    return threads.filter((thread) =>
      `${thread.name} ${thread.category} ${thread.mnemonic}`.toLocaleLowerCase('de-DE').includes(query),
    )
  }, [libraryQuery])

  const analyze = (value = question) => {
    try {
      const next = classifyQuestion(value)
      setQuestion(value)
      setResult(next)
      setError('')
      setFeedbackMessage('')
      setShowCorrection(false)
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : 'Analyse fehlgeschlagen.')
    }
  }

  const persistFeedback = (selectedThreadId: string) => {
    if (!result) return
    const entry: FeedbackEntry = {
      id: createFeedbackId(),
      question: result.input,
      predictedThreadId: result.primary.thread.id,
      selectedThreadId,
      isCorrect: selectedThreadId === result.primary.thread.id,
      createdAt: new Date().toISOString(),
    }
    saveFeedback(entry)
    setFeedbackMessage(
      entry.isCorrect
        ? 'Zuordnung lokal bestätigt.'
        : `Korrektur lokal gespeichert: ${threads.find((thread) => thread.id === selectedThreadId)?.name ?? selectedThreadId}.`,
    )
    setShowCorrection(false)
    onFeedbackSaved()
  }

  return (
    <section className="view" aria-labelledby="analyse-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fragetyp erkennen</p>
          <h1 id="analyse-title">Interviewfrage oder Satzfragment</h1>
          <p>Auch wenige Wörter reichen. Die Zuordnung erfolgt vollständig im Browser und ohne externes LLM.</p>
        </div>
      </div>

      <div className="input-panel">
        <label htmlFor="question">Frage oder Fragment</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) analyze()
          }}
          placeholder="Zum Beispiel: Fachbereich will Chatbot, IT blockiert Datenschutz …"
          rows={5}
        />
        <div className="input-actions">
          <span className="keyboard-hint">Strg + Enter analysiert</span>
          <button className="button button-primary" type="button" onClick={() => analyze()}>
            Roten Faden erkennen
          </button>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>

      <div className="example-row" aria-label="Beispiele">
        {EXAMPLES.map((example) => (
          <button className="example-chip" type="button" key={example} onClick={() => analyze(example)}>
            {example}
          </button>
        ))}
      </div>

      {!result && (
        <div className="empty-state">
          <strong>Ergebnis erscheint hier.</strong>
          <span>Gezeigt werden Hauptfaden, Alternativen, Ziel, Antwortschritte und ein möglicher Einstieg.</span>
        </div>
      )}

      {result && (
        <div className="result-stack" aria-live="polite">
          <div className="metric-grid">
            <div className="metric-card">
              <span>Fragetyp</span>
              <strong>{result.primary.thread.shortName}</strong>
            </div>
            <div className="metric-card">
              <span>Heuristischer Match</span>
              <strong>{result.primary.matchPercent}%</strong>
            </div>
            <div className="metric-card">
              <span>Antwortschritte</span>
              <strong>{result.primary.thread.steps.length}</strong>
            </div>
            <div className="metric-card">
              <span>Kategorie</span>
              <strong>{result.primary.thread.category}</strong>
            </div>
          </div>

          <div className="result-layout">
            <article className="primary-result">
              <div className="result-title-row">
                <div>
                  <span className="status-pill">Primärer Faden</span>
                  <h2>{result.primary.thread.name}</h2>
                </div>
                <MatchBar result={result.primary} />
              </div>

              <p className="result-description">{result.primary.thread.description}</p>

              <div className="why-box">
                <strong>Warum dieser Faden?</strong>
                {result.primary.matchedCues.length > 0 ? (
                  <p>Erkannte Signale: {result.primary.matchedCues.join(', ')}.</p>
                ) : (
                  <p>Die Zuordnung basiert überwiegend auf der Ähnlichkeit zu Beispielen und den Begriffen des Fadens.</p>
                )}
                <small>Der Matchwert ist eine transparente Heuristik, keine statistisch kalibrierte Wahrscheinlichkeit.</small>
              </div>

              <div className="goal-box">
                <span>Ziel der Antwort</span>
                <strong>{result.primary.thread.purpose}</strong>
              </div>

              <ol className="steps-list">
                {result.primary.thread.steps.map((step, index) => (
                  <li key={step}>
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <strong>{step}</strong>
                      <p>{interpolate(result.primary.thread.stepPrompts[index], result.topic)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <blockquote>
                <span>Möglicher Einstieg</span>
                {interpolate(result.primary.thread.opening, result.topic)}
              </blockquote>

              <div className="mnemonic">
                <span>Merksatz</span>
                <strong>{result.primary.thread.mnemonic}</strong>
              </div>
            </article>

            <aside className="result-sidebar">
              <section className="sidebar-section">
                <h3>Alternative Zuordnungen</h3>
                <div className="alternative-list">
                  {result.alternatives.map((alternative) => (
                    <div className="alternative-card" key={alternative.thread.id}>
                      <div>
                        <strong>{alternative.thread.shortName}</strong>
                        <span>{alternative.thread.category}</span>
                      </div>
                      <MatchBar result={alternative} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="sidebar-section feedback-section">
                <h3>Passt die Zuordnung?</h3>
                <p>Deine Bestätigung oder Korrektur wird nur in diesem Browser gespeichert.</p>
                <div className="button-row">
                  <button className="button button-primary" type="button" onClick={() => persistFeedback(result.primary.thread.id)}>
                    Ja, korrekt
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => setShowCorrection((current) => !current)}>
                    Anderer Faden
                  </button>
                </div>
                {feedbackMessage && <p className="success-message">{feedbackMessage}</p>}
              </section>

              {showCorrection && (
                <section className="sidebar-section correction-panel">
                  <label htmlFor="correction-search">Passenden Faden suchen</label>
                  <input
                    id="correction-search"
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="z. B. Risiko oder STAR-L"
                  />
                  <div className="correction-list">
                    {correctionOptions.map((thread) => (
                      <button type="button" key={thread.id} onClick={() => persistFeedback(thread.id)}>
                        <strong>{thread.shortName}</strong>
                        <span>{thread.mnemonic}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      )}
    </section>
  )
}
