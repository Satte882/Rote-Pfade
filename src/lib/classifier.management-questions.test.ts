import { describe, expect, it } from 'vitest'
import { classifyQuestion } from './classifier'

type Case = {
  input: string
  expectedThreadId: string
}

const CASES: Case[] = [
  { input: 'Wie stellen Sie sicher, dass ein KI-Projekt messbaren Business Value erzeugt?', expectedThreadId: 'wirkung' },
  { input: 'Ihr Pilot läuft technisch reibungslos, aber niemand nutzt das Tool. Was tun Sie?', expectedThreadId: 'problem-stoerung' },
  { input: 'Zwei Use Cases: einer mit riesigem theoretischem Potenzial, aber unklarer Datenlage – einer kleiner, aber klar validierbar. Welchen wählen Sie?', expectedThreadId: 'priorisierung' },
  { input: 'Ein Fachbereich blockiert die Einführung eines neuen KI-Tools. Wie gehen Sie vor?', expectedThreadId: 'stakeholder-change' },
  { input: 'Ein KI-Modell trifft automatisierte Entscheidungen mit Kundenauswirkung. Wie viel Kontrolle braucht es?', expectedThreadId: 'risiko-governance' },
  { input: 'Der Pilot war in einer Region erfolgreich. Rollen Sie ihn sofort global aus?', expectedThreadId: 'skalierung' },
  { input: 'Die Trainingsdaten stammen aus einem anderen Land als dem Zielmarkt. Problem?', expectedThreadId: 'ki-eignung' },
  { input: 'Wer haftet, wenn ein KI-System eine Fehlentscheidung trifft?', expectedThreadId: 'risiko-governance' },
  { input: 'Ein Vorstand will "KI überall" ohne konkreten Business Case. Reaktion?', expectedThreadId: 'strategie-zielbild' },
  { input: 'Ihr Pilot läuft seit 3 Monaten "stabil" ohne Abbruchkriterium. Was fehlt?', expectedThreadId: 'entscheidung' },
  { input: 'Sie haben Budget für nur einen von drei Use Cases. Entscheidungskriterium?', expectedThreadId: 'priorisierung' },
  { input: 'Mitarbeitende sabotieren passiv ein neues Tool durch Nichtnutzung. Ursache zuerst klären wie?', expectedThreadId: 'stakeholder-change' },
  { input: 'Ein GenAI-Agent darf automatisch E-Mails an Kunden versenden. Zustimmung?', expectedThreadId: 'risiko-governance' },
  { input: 'Funktioniert ein Prozess, der im Pilot mit 50 Nutzern lief, auch bei 5.000?', expectedThreadId: 'skalierung' },
  { input: 'Die Daten sind vollständig, aber für einen anderen Zweck erhoben. Nutzbar?', expectedThreadId: 'ki-eignung' },
  { input: 'Wie regeln Sie Verantwortlichkeiten zwischen IT, Fachbereich und Compliance bei einem KI-Projekt?', expectedThreadId: 'risiko-governance' },
  { input: 'Der Fachbereich misst Erfolg nur an "Zeitersparnis gefühlt". Reicht das?', expectedThreadId: 'wirkung' },
  { input: 'Ihr Pilot zeigt gemischte Ergebnisse nach 6 Wochen. Verlängern oder stoppen?', expectedThreadId: 'entscheidung' },
  { input: 'Ein Use Case hat hohe strategische Sichtbarkeit, aber schwache Erfolgsaussicht. Priorität?', expectedThreadId: 'priorisierung' },
  { input: 'Ein Team lehnt die Automatisierung ab, weil sie Kontrollverlust fürchtet. Erster Schritt?', expectedThreadId: 'stakeholder-change' },
]

describe('management interview question set', () => {
  it.each(CASES)('$input → $expectedThreadId', ({ input, expectedThreadId }) => {
    const result = classifyQuestion(input, { feedback: [] })
    expect(result.primary.thread.id).toBe(expectedThreadId)
  })
})
