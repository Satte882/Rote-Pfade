import { useEffect, useState } from 'react'
import '../management-training.css'
import { getAnswerGuide } from '../data/answer-guides'
import { threads } from '../lib/classifier'
import {
  loadTrainingStats,
  saveThreadTrainingAnswer,
} from '../lib/storage'
import { createTrainingQuestion } from '../lib/training'

type TrainingMode = 'practice' | 'learn'

const TRAINING_MODE_KEY = 'rote-pfade.training-mode.v1'

function getInitialTrainingMode(): TrainingMode {
  return localStorage.getItem(TRAINING_MODE_KEY) === 'learn' ? 'learn' : 'practice'
}

function resolveTemplate(value: string): string {
  return value.replaceAll('{topic}', 'diesem Fall')
}

export function TrainingView({ dataVersion }: { dataVersion: number }) {
  const [mode, setModeState] = useState<TrainingMode>(getInitialTrainingMode)
  const [question, setQuestion] = useState(() => createTrainingQuestion(threads))
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [learningRevealed, setLearningRevealed] = useState(false)
  const [stats, setStats] = useState(() => loadTrainingStats())

  useEffect(() => {
    setStats(loadTrainingStats())
  }, [dataVersion])

  const threadRevealed = selectedThreadId !== null
  const isThreadCorrect = selectedThreadId === question.correctThread.id
  const threadAccuracy = stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100)
  const resolvedName = question.correctVariant
    ? `${question.correctThread.name} · ${question.correctVariant.name}`
    : question.correctThread.name
  const resolvedSteps = question.correctVariant?.steps ?? question.correctThread.steps
  const resolvedStepPrompts = question.correctVariant?.stepPrompts ?? question.correctThread.stepPrompts
  const resolvedDescription = question.correctVariant?.description ?? question.correctThread.description
  const resolvedMnemonic = question.correctVariant?.mnemonic ?? question.correctThread.mnemonic
  const resolvedOpening = question.correctVariant?.opening ?? question.correctThread.opening
  const guide = getAnswerGuide(question.correctThread.id)
  const relatedThreads = question.correctThread.relatedIds
    .map((id) => threads.find((thread) => thread.id === id))
    .filter((thread): thread is (typeof threads)[number] => Boolean(thread))
    .slice(0, 3)

  const setMode = (nextMode: TrainingMode) => {
    setModeState(nextMode)
    localStorage.setItem(TRAINING_MODE_KEY, nextMode)
    if (nextMode === 'learn') setLearningRevealed(false)
  }

  const selectThread = (threadId: string) => {
    if (threadRevealed) return
    setSelectedThreadId(threadId)
    setStats(saveThreadTrainingAnswer(question.correctThread.id, threadId === question.correctThread.id))
  }

  const nextQuestion = () => {
    setQuestion(createTrainingQuestion(threads, question.prompt))
    setSelectedThreadId(null)
    setLearningRevealed(false)
  }

  return (
    <section className="view training-view" aria-labelledby="training-title">
      <div className="section-heading split-heading training-heading">
        <div>
          <p className="eyebrow">Management-Training</p>
          <h1 id="training-title">
            {mode === 'practice' ? 'Fragetyp, Prüfpunkt und Schritte abrufen' : 'Antwortlogik verstehen und verankern'}
          </h1>
          <p>
            {mode === 'practice'
              ? 'Erst den roten Pfad erkennen. Danach Prüfpunkt und Gesprächsschritte als lineare Antwortlogik abrufen.'
              : 'Verstehen, wie roter Pfad, entscheidender Prüfpunkt und Management-Hintergrund zusammenwirken.'}
          </p>
        </div>
        {mode === 'practice' && (
          <div className="training-stats" aria-label="Trainingsstatistik">
            <div><span>Fragetyp</span><strong>{threadAccuracy}%</strong></div>
          </div>
        )}
      </div>

      <div className="training-mode-switch" role="group" aria-label="Trainingsmodus wählen">
        <button
          className={mode === 'practice' ? 'training-mode-button active' : 'training-mode-button'}
          type="button"
          aria-pressed={mode === 'practice'}
          onClick={() => setMode('practice')}
        >
          <strong>Üben</strong>
          <span>Kompakt abrufen</span>
        </button>
        <button
          className={mode === 'learn' ? 'training-mode-button active' : 'training-mode-button'}
          type="button"
          aria-pressed={mode === 'learn'}
          onClick={() => setMode('learn')}
        >
          <strong>Lernen</strong>
          <span>Ausführlich verstehen</span>
        </button>
      </div>

      {mode === 'practice' ? (
        <div className="training-card">
          <span className="question-label">Interviewfrage</span>
          <h2>{question.prompt}</h2>

          <div className="management-training-stage">
            <span className="management-stage-label">1. Roter Pfad</span>
            <div className="training-options">
              {question.options.map((thread) => {
                const selected = selectedThreadId === thread.id
                const correct = threadRevealed && thread.id === question.correctThread.id
                const wrong = threadRevealed && selected && !correct
                const classes = ['training-option', selected ? 'selected' : '', correct ? 'correct' : '', wrong ? 'wrong' : '']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button className={classes} type="button" key={thread.id} onClick={() => selectThread(thread.id)} disabled={threadRevealed}>
                    <strong>{thread.shortName}</strong>
                    <span>{thread.mnemonic}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {threadRevealed && (
            <div className="practice-answer-guide" aria-live="polite">
              <div className={`management-check ${isThreadCorrect ? 'correct-check' : 'wrong-check'}`}>
                <strong>{isThreadCorrect ? `Fragetyp richtig: ${resolvedName}.` : `Passender Fragetyp: ${resolvedName}.`}</strong>
              </div>

              <section className="practice-checkpoint">
                <span className="management-stage-label">2. Entscheidender Prüfpunkt</span>
                <strong>{guide.checkpoint}</strong>
              </section>

              <section className="practice-conversation-steps">
                <span className="management-stage-label">3. Schritte</span>
                <ol className="conversation-path">
                  {guide.conversationSteps.map((step, index) => (
                    <li key={step}>
                      <span aria-hidden="true">{index + 1}</span>
                      <strong>{step}</strong>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="spoken-schema-strip">
                <span>Sprechen</span>
                <strong>Position → Begründung / Trade-off → Konsequenz → STOP</strong>
              </div>

              <details className="management-background">
                <summary>Fachlicher Management-Hintergrund</summary>
                <div>
                  <strong>{question.correctLever.name}: {question.correctLever.principle}</strong>
                  <p>{question.rationale}</p>
                  <p>{question.correctLever.description}</p>
                </div>
              </details>

              <button className="button button-primary" type="button" onClick={nextQuestion}>Nächste Frage</button>
            </div>
          )}
        </div>
      ) : (
        <div className="training-card learning-card">
          <span className="question-label">Lernfrage</span>
          <h2>{question.prompt}</h2>

          {!learningRevealed ? (
            <div className="learning-start">
              <p>Formuliere gedanklich zuerst: Welcher rote Pfad hilft mir – und was muss ich innerhalb dieses Pfades prüfen?</p>
              <button className="button button-primary" type="button" onClick={() => setLearningRevealed(true)}>
                Lösung anzeigen
              </button>
            </div>
          ) : (
            <div className="learning-content" aria-live="polite">
              <div className="learning-anchor-grid">
                <section className="learning-anchor">
                  <span className="learning-kicker">1. Roter Pfad</span>
                  <h3>{resolvedName}</h3>
                  <p>{resolvedDescription}</p>
                  <div className="learning-principle"><strong>Zweck:</strong> {question.correctThread.purpose}</div>
                </section>

                <section className="learning-anchor checkpoint-anchor">
                  <span className="learning-kicker">2. Entscheidender Prüfpunkt</span>
                  <h3>{guide.checkpoint}</h3>
                  <p>Der Prüfpunkt ist kein eigener Antwortblock. Er bestimmt, worauf du innerhalb der Schritte fokussierst.</p>
                </section>
              </div>

              <section className="learning-section">
                <span className="learning-kicker">3. Gesprächsschritte</span>
                <ol className="conversation-path learning-conversation-path">
                  {guide.conversationSteps.map((step, index) => (
                    <li key={step}>
                      <span aria-hidden="true">{index + 1}</span>
                      <strong>{step}</strong>
                    </li>
                  ))}
                </ol>
                <div className="spoken-schema-strip">
                  <span>Sprechen</span>
                  <strong>Position → Begründung / Trade-off → Konsequenz → STOP</strong>
                </div>
              </section>

              <section className="learning-section">
                <span className="learning-kicker">Ausführliche Denkstruktur</span>
                <ol className="learning-steps">
                  {resolvedSteps.map((step, index) => (
                    <li key={step}>
                      <span className="learning-step-index" aria-hidden="true">{index + 1}</span>
                      <div>
                        <strong>{step}</strong>
                        {resolvedStepPrompts[index] && <p>{resolveTemplate(resolvedStepPrompts[index])}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="learning-section">
                <span className="learning-kicker">Warum passt das?</span>
                <p>{question.rationale}</p>
              </section>

              <section className="learning-section management-background-card">
                <span className="learning-kicker">Fachlicher Management-Hintergrund</span>
                <h3>{question.correctLever.name}</h3>
                <p>{question.correctLever.description}</p>
                <div className="learning-principle"><strong>Prinzip:</strong> {question.correctLever.principle}</div>
              </section>

              <section className="learning-section learning-position">
                <span className="learning-kicker">Möglicher Einstieg</span>
                <p>{resolveTemplate(resolvedOpening)}</p>
              </section>

              {relatedThreads.length > 0 && (
                <section className="learning-section">
                  <span className="learning-kicker">Abgrenzung / verwandte Denkpfade</span>
                  <p className="learning-muted">Diese Fäden können passen, wenn der Schwerpunkt der Interviewfrage anders liegt.</p>
                  <div className="learning-related">
                    {relatedThreads.map((thread) => (
                      <div key={thread.id}>
                        <strong>{thread.shortName}</strong>
                        <span>{thread.description}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="learning-memory">
                <span>Merksatz</span>
                <strong>{resolvedMnemonic}</strong>
              </div>

              <button className="button button-primary" type="button" onClick={nextQuestion}>Nächste Lernfrage</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
