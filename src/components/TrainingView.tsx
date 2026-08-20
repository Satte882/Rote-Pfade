import { useEffect, useState } from 'react'
import '../management-training.css'
import { threads } from '../lib/classifier'
import {
  loadTrainingStats,
  saveLeverTrainingAnswer,
  saveThreadTrainingAnswer,
} from '../lib/storage'
import { createTrainingQuestion } from '../lib/training'

export function TrainingView({ dataVersion }: { dataVersion: number }) {
  const [question, setQuestion] = useState(() => createTrainingQuestion(threads))
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedLeverId, setSelectedLeverId] = useState<string | null>(null)
  const [stats, setStats] = useState(() => loadTrainingStats())

  useEffect(() => {
    setStats(loadTrainingStats())
  }, [dataVersion])

  const threadRevealed = selectedThreadId !== null
  const leverRevealed = selectedLeverId !== null
  const isThreadCorrect = selectedThreadId === question.correctThread.id
  const isLeverCorrect = selectedLeverId === question.correctLever.id
  const threadAccuracy = stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100)
  const leverAccuracy = stats.leverAnswered === 0 ? 0 : Math.round((stats.leverCorrect / stats.leverAnswered) * 100)
  const resolvedName = question.correctVariant
    ? `${question.correctThread.name} · ${question.correctVariant.name}`
    : question.correctThread.name
  const resolvedSteps = question.correctVariant?.steps ?? question.correctThread.steps

  const selectThread = (threadId: string) => {
    if (threadRevealed) return
    setSelectedThreadId(threadId)
    setStats(saveThreadTrainingAnswer(question.correctThread.id, threadId === question.correctThread.id))
  }

  const selectLever = (leverId: string) => {
    if (!threadRevealed || leverRevealed) return
    setSelectedLeverId(leverId)
    setStats(saveLeverTrainingAnswer(question.correctLever.id, leverId === question.correctLever.id))
  }

  const nextQuestion = () => {
    setQuestion(createTrainingQuestion(threads, question.prompt))
    setSelectedThreadId(null)
    setSelectedLeverId(null)
  }

  return (
    <section className="view" aria-labelledby="training-title">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">Management-Training V1</p>
          <h1 id="training-title">Fragetyp und Management-Hebel erkennen</h1>
          <p>Erst den roten Faden bestimmen, danach den entscheidenden Hebel der konkreten Frage.</p>
        </div>
        <div className="training-stats" aria-label="Trainingsstatistik">
          <div><span>Fragetyp</span><strong>{threadAccuracy}%</strong></div>
          <div><span>Hebel</span><strong>{leverAccuracy}%</strong></div>
        </div>
      </div>

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
          <>
            <div className={`management-check ${isThreadCorrect ? 'correct-check' : 'wrong-check'}`} aria-live="polite">
              <strong>{isThreadCorrect ? `Fragetyp richtig: ${resolvedName}.` : `Passender Fragetyp: ${resolvedName}.`}</strong>
            </div>

            <div className="management-training-stage">
              <span className="management-stage-label">2. Management-Hebel</span>
              <p className="management-stage-prompt">Was ist in dieser konkreten Frage der entscheidende Hebel?</p>
              <div className="training-options management-lever-options">
                {question.leverOptions.map((lever) => {
                  const selected = selectedLeverId === lever.id
                  const correct = leverRevealed && lever.id === question.correctLever.id
                  const wrong = leverRevealed && selected && !correct
                  const classes = ['training-option', selected ? 'selected' : '', correct ? 'correct' : '', wrong ? 'wrong' : '']
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <button className={classes} type="button" key={lever.id} onClick={() => selectLever(lever.id)} disabled={leverRevealed}>
                      <strong>{lever.name}</strong>
                      <span>{lever.principle}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {leverRevealed && (
          <div className={`training-feedback ${isLeverCorrect ? 'correct-feedback' : 'wrong-feedback'}`} aria-live="polite">
            <strong>{isLeverCorrect ? `Hebel richtig: ${question.correctLever.name}.` : `Passender Hebel: ${question.correctLever.name}.`}</strong>
            <p><strong>Prinzip:</strong> {question.correctLever.principle}</p>
            <p>{question.rationale}</p>
            <div className="management-lever-description">{question.correctLever.description}</div>
            <div className="mini-thread"><strong>Roter Pfad:</strong> {resolvedSteps.join(' → ')}</div>
            <button className="button button-primary" type="button" onClick={nextQuestion}>Nächste Frage</button>
          </div>
        )}
      </div>
    </section>
  )
}
