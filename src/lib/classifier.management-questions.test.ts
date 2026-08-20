import { describe, expect, it } from 'vitest'
import { classifyQuestion } from './classifier'

const EXACT_ROUTING_CASES = [
  {
    input: 'Wie stellen Sie sicher, dass ein KI-Projekt messbaren Business Value erzeugt?',
    expectedThreadId: 'wirkung',
  },
  {
    input: 'Ihr Pilot läuft technisch reibungslos, aber niemand nutzt das Tool. Was tun Sie?',
    expectedThreadId: 'problem-stoerung',
  },
  {
    input: 'Der Fachbereich misst Erfolg nur an "Zeitersparnis gefühlt". Reicht das?',
    expectedThreadId: 'wirkung',
  },
  {
    input: 'Ihr Pilot zeigt gemischte Ergebnisse nach 6 Wochen. Verlängern oder stoppen?',
    expectedThreadId: 'entscheidung',
  },
]

const DIAGNOSTIC_CASES = [
  'Zwei Use Cases: einer mit riesigem theoretischem Potenzial, aber unklarer Datenlage – einer kleiner, aber klar validierbar. Welchen wählen Sie?',
  'Ein Fachbereich blockiert die Einführung eines neuen KI-Tools. Wie gehen Sie vor?',
  'Ein KI-Modell trifft automatisierte Entscheidungen mit Kundenauswirkung. Wie viel Kontrolle braucht es?',
  'Der Pilot war in einer Region erfolgreich. Rollen Sie ihn sofort global aus?',
  'Die Trainingsdaten stammen aus einem anderen Land als dem Zielmarkt. Problem?',
  'Wer haftet, wenn ein KI-System eine Fehlentscheidung trifft?',
  'Ein Vorstand will "KI überall" ohne konkreten Business Case. Reaktion?',
  'Ihr Pilot läuft seit 3 Monaten "stabil" ohne Abbruchkriterium. Was fehlt?',
  'Sie haben Budget für nur einen von drei Use Cases. Entscheidungskriterium?',
  'Mitarbeitende sabotieren passiv ein neues Tool durch Nichtnutzung. Ursache zuerst klären wie?',
  'Ein GenAI-Agent darf automatisch E-Mails an Kunden versenden. Zustimmung?',
  'Funktioniert ein Prozess, der im Pilot mit 50 Nutzern lief, auch bei 5.000?',
  'Die Daten sind vollständig, aber für einen anderen Zweck erhoben. Nutzbar?',
  'Wie regeln Sie Verantwortlichkeiten zwischen IT, Fachbereich und Compliance bei einem KI-Projekt?',
  'Ein Use Case hat hohe strategische Sichtbarkeit, aber schwache Erfolgsaussicht. Priorität?',
  'Ein Team lehnt die Automatisierung ab, weil sie Kontrollverlust fürchtet. Erster Schritt?',
]

describe('management interview routing guards', () => {
  it.each(EXACT_ROUTING_CASES)('$input → $expectedThreadId', ({ input, expectedThreadId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(expectedThreadId)
  })
})

describe('management interview diagnostic cases', () => {
  it.each(DIAGNOSTIC_CASES)('%s returns a usable routing set', (input) => {
    const result = classifyQuestion(input, { feedback: [] })
    const routingSet = [result.primary, ...result.alternatives]

    expect(result.primary.thread.id).toBeTruthy()
    expect(routingSet.length).toBe(3)
    expect(new Set(routingSet.map((entry) => entry.thread.id)).size).toBe(3)
    expect(['clear', 'ambiguous', 'weak']).toContain(result.evidence)
  })
})
