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
  {
    input: 'Ein Prozess funktioniert mit 50 Pilotnutzern. Was prüfen Sie vor der Ausweitung auf 5.000 Nutzer?',
    expectedThreadId: 'skalierung',
  },
  {
    input: 'Was müssen Sie vor der Ausweitung eines Piloten auf deutlich mehr Nutzer prüfen?',
    expectedThreadId: 'skalierung',
  },
]

const DIAGNOSTIC_CASES = [
  {
    input: 'Zwei Use Cases: einer mit riesigem theoretischem Potenzial, aber unklarer Datenlage – einer kleiner, aber klar validierbar. Welchen wählen Sie?',
    acceptableThreadIds: ['priorisierung', 'entscheidung-unsicherheit'],
  },
  {
    input: 'Ein Fachbereich blockiert die Einführung eines neuen KI-Tools. Wie gehen Sie vor?',
    acceptableThreadIds: ['stakeholder-change', 'stakeholder-konflikt'],
  },
  {
    input: 'Ein KI-Modell trifft automatisierte Entscheidungen mit Kundenauswirkung. Wie viel Kontrolle braucht es?',
    acceptableThreadIds: ['risiko-governance', 'entscheidung'],
  },
  {
    input: 'Der Pilot war in einer Region erfolgreich. Rollen Sie ihn sofort global aus?',
    acceptableThreadIds: ['skalierung', 'wirkung'],
  },
  {
    input: 'Die Trainingsdaten stammen aus einem anderen Land als dem Zielmarkt. Problem?',
    acceptableThreadIds: ['ki-eignung', 'risiko-governance'],
  },
  {
    input: 'Wer haftet, wenn ein KI-System eine Fehlentscheidung trifft?',
    acceptableThreadIds: ['risiko-governance'],
  },
  {
    input: 'Ein Vorstand will "KI überall" ohne konkreten Business Case. Reaktion?',
    acceptableThreadIds: ['strategie-zielbild', 'ki-eignung'],
  },
  {
    input: 'Ihr Pilot läuft seit 3 Monaten "stabil" ohne Abbruchkriterium. Was fehlt?',
    acceptableThreadIds: ['entscheidung', 'skalierung'],
  },
  {
    input: 'Sie haben Budget für nur einen von drei Use Cases. Entscheidungskriterium?',
    acceptableThreadIds: ['priorisierung'],
  },
  {
    input: 'Mitarbeitende sabotieren passiv ein neues Tool durch Nichtnutzung. Ursache zuerst klären wie?',
    acceptableThreadIds: ['stakeholder-change', 'problem-stoerung'],
  },
  {
    input: 'Ein GenAI-Agent darf automatisch E-Mails an Kunden versenden. Zustimmung?',
    acceptableThreadIds: ['risiko-governance'],
  },
  {
    input: 'Funktioniert ein Prozess, der im Pilot mit 50 Nutzern lief, auch bei 5.000?',
    acceptableThreadIds: ['skalierung'],
  },
  {
    input: 'Die Daten sind vollständig, aber für einen anderen Zweck erhoben. Nutzbar?',
    acceptableThreadIds: ['ki-eignung'],
  },
  {
    input: 'Wie regeln Sie Verantwortlichkeiten zwischen IT, Fachbereich und Compliance bei einem KI-Projekt?',
    acceptableThreadIds: ['risiko-governance', 'stakeholder-konflikt'],
  },
  {
    input: 'Ein Use Case hat hohe strategische Sichtbarkeit, aber schwache Erfolgsaussicht. Priorität?',
    acceptableThreadIds: ['priorisierung'],
  },
  {
    input: 'Ein Team lehnt die Automatisierung ab, weil sie Kontrollverlust fürchtet. Erster Schritt?',
    acceptableThreadIds: ['stakeholder-change'],
  },
]

describe('management interview routing guards', () => {
  it.each(EXACT_ROUTING_CASES)('$input → $expectedThreadId', ({ input, expectedThreadId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(expectedThreadId)
  })
})

describe('management interview diagnostic cases', () => {
  it.each(DIAGNOSTIC_CASES)('$input surfaces a useful answer path', ({ input, acceptableThreadIds }) => {
    const result = classifyQuestion(input, { feedback: [] })
    const routingSet = [result.primary, ...result.alternatives]
    const routingIds = routingSet.map((entry) => entry.thread.id)

    expect(routingSet.length).toBe(3)
    expect(new Set(routingIds).size).toBe(3)
    expect(routingIds.some((threadId) => acceptableThreadIds.includes(threadId))).toBe(true)
  })
})
