import { describe, expect, it } from 'vitest'
import { classifyQuestion, getResolvedSteps } from './classifier'
import type { FeedbackEntry } from '../types/thread'

type Case = {
  input: string
  threadId: string
  variantId?: string
}

const CASES: Case[] = [
  { input: 'make or buy', threadId: 'entscheidung', variantId: 'make-or-buy' },
  { input: 'build or buy', threadId: 'entscheidung', variantId: 'make-or-buy' },
  { input: 'Intern entwickeln oder zukaufen?', threadId: 'entscheidung', variantId: 'make-or-buy' },
  { input: 'Anbieter auswählen', threadId: 'entscheidung', variantId: 'anbieterauswahl' },
  { input: 'Welches Tool sollen wir auswählen?', threadId: 'entscheidung', variantId: 'anbieterauswahl' },
  { input: 'Vendor Selection für eine GenAI-Plattform', threadId: 'entscheidung', variantId: 'anbieterauswahl' },
  { input: 'Pilot fortführen oder stoppen?', threadId: 'entscheidung', variantId: 'pilotentscheidung' },
  { input: 'Go No-Go nach dem MVP', threadId: 'entscheidung', variantId: 'pilotentscheidung' },
  { input: 'Wie führen Sie eine strukturierte Prozessanalyse durch?', threadId: 'vorgehen', variantId: 'prozessanalyse' },
  { input: 'Wie analysieren Sie den Ist-Prozess?', threadId: 'vorgehen', variantId: 'prozessanalyse' },
  { input: 'Wie würden Sie ein neues Projekt starten?', threadId: 'vorgehen', variantId: 'projektstart' },
  { input: 'KI-Initiative aufsetzen', threadId: 'vorgehen', variantId: 'projektstart' },
  { input: 'Wie kommen Sie von der Idee zur Umsetzung?', threadId: 'vorgehen', variantId: 'loesungsentwicklung' },
  { input: 'Von der Anforderung zur umsetzbaren Lösung', threadId: 'vorgehen', variantId: 'loesungsentwicklung' },
  { input: 'Wie entwickeln Sie eine KI-Strategie?', threadId: 'strategie-zielbild' },
  { input: 'Digitalstrategie für einen Mittelständler', threadId: 'strategie-zielbild' },
  { input: 'Wie entwickeln Sie ein strategisches Zielbild?', threadId: 'strategie-zielbild' },
  { input: 'Wie bauen Sie eine KI-Roadmap auf?', threadId: 'strategie-zielbild' },
  { input: 'Target Operating Model für die KI-Organisation', threadId: 'strategie-zielbild' },
  { input: 'Wir haben noch keine Daten, müssen aber entscheiden.', threadId: 'entscheidung-unsicherheit' },
  { input: 'Die technische Machbarkeit ist noch unklar.', threadId: 'entscheidung-unsicherheit' },
  { input: 'Der Business Case ist noch offen, das Management braucht trotzdem eine Empfehlung.', threadId: 'entscheidung-unsicherheit' },
  { input: 'Wie entscheiden Sie bei fehlender Evidenz?', threadId: 'entscheidung-unsicherheit' },
  { input: 'Die Lösung ist noch nicht bewiesen. Wie gehen Sie vor?', threadId: 'entscheidung-unsicherheit' },
  { input: 'Woran erkennen Sie einen geeigneten KI-Use-Case?', threadId: 'ki-eignung' },
  { input: 'Use Case Assessment vor dem Pilot', threadId: 'ki-eignung' },
  { input: 'Wann ist KI für diesen Prozess sinnvoll?', threadId: 'ki-eignung' },
  { input: 'Was ist der Unterschied zwischen Pilot und MVP?', threadId: 'vergleich' },
  { input: 'Agil oder klassisch: Wann setzen Sie welchen Ansatz ein?', threadId: 'vergleich' },
  { input: 'Pilot oder Direktrollout: Was passt wann?', threadId: 'vergleich' },
  { input: 'Wie skalieren Sie einen erfolgreichen Piloten?', threadId: 'skalierung' },
  { input: 'Wie kommen Sie vom MVP zum produktiven Betrieb?', threadId: 'skalierung' },
  { input: 'KI-Lösung unternehmensweit einführen', threadId: 'skalierung' },
  { input: 'Wie nehmen Sie die Mitarbeiter mit?', threadId: 'stakeholder-change' },
  { input: 'Wie gehen Sie mit Widerstand gegen neue Arbeitsweisen um?', threadId: 'stakeholder-change' },
  { input: 'Wie erhöhen Sie die Adoption nach dem Rollout?', threadId: 'stakeholder-change' },
  { input: 'Fachbereich und IT vertreten gegensätzliche Positionen.', threadId: 'stakeholder-konflikt' },
  { input: 'Beide Seiten sind sich nicht einig. Wie moderieren Sie?', threadId: 'stakeholder-konflikt' },
  { input: 'Datenschutz blockt den KI-Piloten.', threadId: 'stakeholder-konflikt' },
  { input: 'Wie gehen Sie mit Bias in einem KI-Modell um?', threadId: 'risiko-governance' },
  { input: 'Welche Anforderungen stellt der EU AI Act?', threadId: 'risiko-governance' },
  { input: 'Responsible AI und menschliche Aufsicht sicherstellen', threadId: 'risiko-governance' },
  { input: 'Wie bauen Sie Governance für GenAI auf?', threadId: 'risiko-governance' },
  { input: 'Wie messen Sie den Erfolg des KI-Piloten?', threadId: 'wirkung' },
  { input: 'Business Value einer Automatisierung nachweisen', threadId: 'wirkung' },
  { input: 'Welche KPIs verwenden Sie?', threadId: 'wirkung' },
  { input: 'Wie priorisieren Sie mehrere KI-Use-Cases?', threadId: 'priorisierung' },
  { input: 'Use Case Prioritization im Portfolio', threadId: 'priorisierung' },
  { input: 'Welches Projekt setzen Sie bei begrenzten Ressourcen zuerst um?', threadId: 'priorisierung' },
  { input: 'Erzählen Sie von einem schwierigen Projekt.', threadId: 'star-l' },
  { input: 'Was war Ihr größter Fehler und was haben Sie gelernt?', threadId: 'star-l' },
  { input: 'Beschreiben Sie eine Situation, in der Sie einen Konflikt gelöst haben.', threadId: 'star-l' },
  { input: 'Der Pilot wird kaum genutzt. Was tun Sie?', threadId: 'problem-stoerung' },
  { input: 'Das Projekt liegt hinter dem Plan.', threadId: 'problem-stoerung' },
  { input: 'Die Lösung funktioniert nicht zuverlässig.', threadId: 'problem-stoerung' },
]

describe('classifyQuestion regression cases', () => {
  it.each(CASES)('$input → $threadId / $variantId', ({ input, threadId, variantId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(threadId)
    if (variantId) expect(result.primary.selectedVariant?.id).toBe(variantId)
  })
})

describe('resolved answer paths', () => {
  it('uses the concrete Make-or-Buy path instead of the generic decision path', () => {
    const result = classifyQuestion('make or buy', { feedback: [] })
    expect(getResolvedSteps(result.primary)).toEqual([
      'Entscheidungskriterien festlegen',
      'Make, Buy und gegebenenfalls Hybrid abgrenzen',
      'Fakten und Annahmen je Option erheben',
      'Optionen anhand der Kriterien bewerten',
      'Empfehlung, Risiken und nächsten Schritt ableiten',
    ])
  })

  it('uses diagnostic steps for a process analysis', () => {
    const result = classifyQuestion('Prozessanalyse durchführen', { feedback: [] })
    const steps = getResolvedSteps(result.primary)
    expect(result.primary.selectedVariant?.id).toBe('prozessanalyse')
    expect(steps[2]).toBe('Schwachstellen, Ursachen und Muster analysieren')
    expect(steps).not.toContain('Lösungsoptionen entwickeln')
  })

  it('marks an unrelated short fragment as weak evidence', () => {
    const result = classifyQuestion('operatives Thema', { feedback: [] })
    expect(result.evidence).toBe('weak')
  })
})

describe('local feedback overrides', () => {
  const override: FeedbackEntry = {
    id: 'test-override',
    question: 'Make or Buy?',
    predictedThreadId: 'entscheidung',
    predictedVariantId: 'make-or-buy',
    selectedThreadId: 'strategie-zielbild',
    isCorrect: false,
    createdAt: '2026-08-01T00:00:00.000Z',
  }

  it('reuses an exact normalized local correction', () => {
    const result = classifyQuestion('  MAKE OR BUY!!! ', { feedback: [override] })
    expect(result.primary.thread.id).toBe('strategie-zielbild')
    expect(result.overrideApplied).toBe(true)
    expect(result.evidence).toBe('clear')
  })

  it('reuses a locally selected variant', () => {
    const variantOverride: FeedbackEntry = {
      ...override,
      id: 'variant-override',
      question: 'Tool auswählen',
      selectedThreadId: 'entscheidung',
      selectedVariantId: 'anbieterauswahl',
    }
    const result = classifyQuestion('Tool auswählen', { feedback: [variantOverride] })
    expect(result.primary.thread.id).toBe('entscheidung')
    expect(result.primary.selectedVariant?.id).toBe('anbieterauswahl')
    expect(result.overrideApplied).toBe(true)
  })
})

describe('input validation', () => {
  it('rejects empty input', () => {
    expect(() => classifyQuestion('   ', { feedback: [] })).toThrow()
  })
})
