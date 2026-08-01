import { useEffect, useState } from 'react'
import { threads } from '../lib/classifier'
import { loadTrainingStats, saveTrainingAnswer } from '../lib/storage'
import { createTrainingQuestion } from '../lib/training'

export function TrainingView({ dataVersion }: { dataVersion: number }) {
  const [question, setQuestion] = useState(() => createTrainingQuestion(threads))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stats, setStats] = useState(() => loadTrainingStats())

  useEffect(() => {
    setStats(loadTrainingStats())
  }, [dataVersion])

  const revealed = selectedId !== null
  const isCorrect = selectedId === question.correctThread.id
  const accuracy = stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100)
  const resolvedName = question.correctVariant
    ? `${question.correctThread.name} · ${question.correctVariant.name}`
    : question.correctThread.name
  const resolvedSteps = question.correctVariant?.steps ?? question.correctThread.steps

  const selectAnswer = (threadId: string) => {
    if (revealed) return
    setSelectedId(threadId)
    setStats(saveTrainingAnswer(question.correctThread.id, threadId === question.correctThread.id))
  }

  const nextQuestion = () => {
    setQuestion(createTrainingQuestion(threads, question.prompt))
    setSelectedId(null)
  }

  return (
    <section className="view" aria-labelledby="training-title">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">Aktives Training</p>
          <h1 id="training-title">Fragetyp zuerst selbst erkennen</h1>
          <p>Wähle den roten Faden, bevor die Lösung und die konkrete Variante sichtbar werden.</p>
        </div>
        <div className="training-stats">
          <div><span>Beantwortet</span><strong>{stats.answered}</strong></div>
          <div><span>Trefferquote</span><strong>{accuracy}%</strong></div>
        </div>
      </div>

      <div className="training-card">
        <span className="question-label">Interviewfrage</span>
        <h2>{question.prompt}</h2>

        <div className="training-options">
          {question.options.map((thread) => {
            const selected = selectedId === thread.id
            const correct = revealed && thread.id === question.correctThread.id
            const wrong = revealed && selected && !correct
            const classes = ['training-option', selected ? 'selected' : '', correct ? 'correct' : '', wrong ? 'wrong' : '']
              .filter(Boolean)
              .join(' ')
            return (
              <button className={classes} type="button" key={thread.id} onClick={() => selectAnswer(thread.id)} disabled={revealed}>
                <strong>{thread.shortName}</strong>
                <span>{thread.mnemonic}</span>
              </button>
            )
          })}
        </div>

        {revealed && (
          <div className={`training-feedback ${isCorrect ? 'correct-feedback' : 'wrong-feedback'}`} aria-live="polite">
            <strong>{isCorrect ? `Richtig: ${resolvedName}.` : `Passender ist: ${resolvedName}.`}</strong>
            <p>{question.correctVariant?.description ?? question.correctThread.description}</p>
            <div className="mini-thread">{resolvedSteps.join(' → ')}</div>
            <button className="button button-primary" type="button" onClick={nextQuestion}>Nächste Frage</button>
          </div>
        )}
      </div>
    </section>
  )
}
