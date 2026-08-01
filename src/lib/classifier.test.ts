import { describe, expect, it } from 'vitest'
import { classifyQuestion } from './classifier'

describe('classifyQuestion', () => {
  it('erkennt einen Stakeholder-Konflikt', () => {
    const result = classifyQuestion('Fachbereich will einen Chatbot, aber die IT blockiert wegen Datenschutz.')
    expect(result.primary.thread.id).toBe('stakeholder-konflikt')
  })

  it('erkennt eine Entscheidung unter Unsicherheit', () => {
    const result = classifyQuestion('Wie entscheiden Sie, obwohl noch wichtige Informationen fehlen?')
    expect(result.primary.thread.id).toBe('entscheidung-unsicherheit')
  })

  it('erkennt eine STAR-L-Frage', () => {
    const result = classifyQuestion('Erzählen Sie von einem schwierigen Projekt und was Sie daraus gelernt haben.')
    expect(result.primary.thread.id).toBe('star-l')
  })

  it('erkennt eine Vergleichsfrage', () => {
    const result = classifyQuestion('Was ist der Unterschied zwischen einem Pilot und einem MVP?')
    expect(result.primary.thread.id).toBe('vergleich')
  })

  it('liefert bei sehr knapper Eingabe einen Fallback', () => {
    const result = classifyQuestion('Projekt')
    expect(result.primary.thread.id).toBeTruthy()
    expect(result.alternatives).toHaveLength(2)
  })

  it('weist leere Eingaben zurück', () => {
    expect(() => classifyQuestion('   ')).toThrow()
  })
})
