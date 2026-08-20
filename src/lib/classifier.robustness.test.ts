import { describe, expect, it } from 'vitest'
import { classifyQuestion } from './classifier'

type RobustnessCase = {
  input: string
  expectedThreadId: string
}

const PROBLEM_AND_SPEECH_CASES: RobustnessCase[] = [
  {
    input: 'Ein KI Projekt läuft nicht so gut. Was machst du?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Polizei Ja ein KI Projekt läuft nicht so gut Was machst du',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Also ja unser KI Projekt läuft gerade nicht gut wie gehst du vor',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Äh das KI Projekt läuft nicht gut was würden Sie machen',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Unser KI Pilot macht Probleme. Was würden Sie tun?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Die Ergebnisse sind schlechter als erwartet. Wie reagieren Sie?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Das Projekt stockt und wir wissen nicht warum. Was tun Sie?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Die Lösung wird fast nicht genutzt. Was machen Sie?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Das Modell macht zu viele Fehler. Wie gehen Sie vor?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Wir liegen deutlich hinter dem Zeitplan. Was nun?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Okay ja das Modell liefert schlechte Ergebnisse was tun sie',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Polizei ein Pilot wird kaum genutzt was machen Sie',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Ja ja Projekt verzögert wie reagieren Sie',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Die neue KI Lösung funktioniert nicht zuverlässig. Was ist Ihr Vorgehen?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Das Team meldet immer mehr Fehler im KI System. Was machen Sie zuerst?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Der KI Pilot liefert plötzlich deutlich schlechtere Resultate. Wie gehen Sie damit um?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Wir haben ein laufendes KI Projekt und die Nutzer sind unzufrieden. Was tun Sie?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Das Projekt ist in Schwierigkeiten und die Ursache ist noch unklar. Wie reagieren Sie?',
    expectedThreadId: 'problem-stoerung',
  },
]

const NEGATIVE_CONTROL_CASES: RobustnessCase[] = [
  {
    input: 'Wie entwickeln Sie eine KI Strategie für das Unternehmen?',
    expectedThreadId: 'strategie-zielbild',
  },
  {
    input: 'Unser Unternehmen hat noch keine KI Strategie. Wie gehen Sie strategisch vor?',
    expectedThreadId: 'strategie-zielbild',
  },
  {
    input: 'Wie priorisieren Sie drei KI Projekte mit begrenztem Budget?',
    expectedThreadId: 'priorisierung',
  },
  {
    input: 'KI oder klassische Automatisierung: Was ist für diesen Prozess sinnvoll?',
    expectedThreadId: 'ki-eignung',
  },
  {
    input: 'Ein KI Projekt birgt erhebliche Datenschutzrisiken. Wie gehen Sie damit um?',
    expectedThreadId: 'risiko-governance',
  },
  {
    input: 'Der Fachbereich lehnt das neue KI Tool ab. Wie gehen Sie mit dem Widerstand um?',
    expectedThreadId: 'stakeholder-change',
  },
  {
    input: 'IT und Fachbereich streiten über die Priorität des KI Projekts. Wie moderieren Sie?',
    expectedThreadId: 'stakeholder-konflikt',
  },
  {
    input: 'Wie messen Sie, ob das KI Projekt erfolgreich ist?',
    expectedThreadId: 'wirkung',
  },
  {
    input: 'Wie skalieren Sie ein erfolgreiches KI Projekt auf das ganze Unternehmen?',
    expectedThreadId: 'skalierung',
  },
  {
    input: 'Wie würden Sie ein neues KI Projekt starten?',
    expectedThreadId: 'vorgehen',
  },
  {
    input: 'Welche KI Projekte setzen Sie bei knappen Ressourcen zuerst um?',
    expectedThreadId: 'priorisierung',
  },
  {
    input: 'Soll der KI Pilot fortgeführt oder gestoppt werden?',
    expectedThreadId: 'entscheidung',
  },
]

describe('classifier robustness for natural speech and dictation noise', () => {
  it.each(PROBLEM_AND_SPEECH_CASES)('$input → $expectedThreadId', ({ input, expectedThreadId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(expectedThreadId)
  })
})

describe('classifier robustness negative controls', () => {
  it.each(NEGATIVE_CONTROL_CASES)('$input → $expectedThreadId', ({ input, expectedThreadId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(expectedThreadId)
  })
})
