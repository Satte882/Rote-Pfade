export type AnswerGuide = {
  threadId: string
  checkpoint: string
  conversationSteps: string[]
  recognitionExamples: string[]
}

export const answerGuides: Record<string, AnswerGuide> = {
  vorgehen: {
    threadId: 'vorgehen',
    checkpoint: 'Was muss ich zuerst klären oder absichern, bevor ich Maßnahmen starte?',
    conversationSteps: ['Ausgangslage', 'Struktur', 'Umsetzung', 'Kontrolle'],
    recognitionExamples: [
      'Wie würden Sie bei der Einführung eines KI-Tools vorgehen?',
      'Wie starten Sie ein neues Automatisierungsprojekt?',
      'Wie würden Sie einen Pilot strukturiert aufsetzen?',
    ],
  },
  'strategie-zielbild': {
    threadId: 'strategie-zielbild',
    checkpoint: 'Welchen konkreten Unternehmensnutzen soll das Zielbild erzeugen?',
    conversationSteps: ['Kontext', 'Zielbild', 'Handlungsfelder', 'Roadmap'],
    recognitionExamples: [
      'Wie entwickeln Sie eine KI-Strategie für einen Fachbereich?',
      'Wie sieht für Sie ein sinnvolles Zielbild für den KI-Einsatz aus?',
      'Wie würden Sie KI-Initiativen strategisch ausrichten?',
    ],
  },
  'problem-stoerung': {
    threadId: 'problem-stoerung',
    checkpoint: 'Welche zentrale Erwartung wird verletzt – und ist die Ursache behebbar?',
    conversationSteps: ['Symptom', 'Ursache', 'Maßnahme', 'Wirkung'],
    recognitionExamples: [
      'Ihr Pilot läuft technisch gut, aber niemand nutzt ihn. Was tun Sie?',
      'Ein KI-Projekt liefert schlechtere Ergebnisse als erwartet. Wie gehen Sie vor?',
      'Die Einführung stockt. Was ist Ihr erster Schritt?',
    ],
  },
  entscheidung: {
    threadId: 'entscheidung',
    checkpoint: 'Welches Kriterium entscheidet zwischen den Optionen wirklich?',
    conversationSteps: ['Kriterien', 'Optionen', 'Abwägung', 'Entscheidung'],
    recognitionExamples: [
      'Würden Sie den Piloten fortführen oder stoppen?',
      'Build or Buy – wie entscheiden Sie?',
      'Zwei Lösungsoptionen stehen zur Wahl. Wie treffen Sie die Entscheidung?',
    ],
  },
  'entscheidung-unsicherheit': {
    threadId: 'entscheidung-unsicherheit',
    checkpoint: 'Welche Unsicherheit muss ich reduzieren, bevor ich belastbar entscheide?',
    conversationSteps: ['Unsicherheit', 'Annahmen', 'Risiko', 'Entscheidung'],
    recognitionExamples: [
      'Die Datenlage ist unklar, aber Sie müssen entscheiden. Was tun Sie?',
      'Sie haben noch keine belastbaren Ergebnisse – würden Sie trotzdem investieren?',
      'Wie entscheiden Sie, wenn wichtige Annahmen noch nicht bestätigt sind?',
    ],
  },
  'ki-eignung': {
    threadId: 'ki-eignung',
    checkpoint: 'Brauche ich für dieses Problem tatsächlich KI – und entsteht daraus messbarer Nutzen?',
    conversationSteps: ['Problem', 'Nutzen', 'Daten / Machbarkeit', 'Verantwortung', 'Entscheidung'],
    recognitionExamples: [
      'Woher wissen Sie, ob ein Problem überhaupt für KI geeignet ist?',
      'Wann würden Sie bewusst keine KI einsetzen?',
      'Wie bewerten Sie einen neuen KI-Use-Case?',
    ],
  },
  vergleich: {
    threadId: 'vergleich',
    checkpoint: 'Welcher Unterschied ist für die Entscheidung wirklich relevant?',
    conversationSteps: ['Kriterien', 'Unterschiede', 'Trade-off', 'Empfehlung'],
    recognitionExamples: [
      'Welchen der beiden Use Cases würden Sie wählen?',
      'Was ist besser: klassische Automatisierung oder GenAI?',
      'Wie vergleichen Sie zwei Lösungsansätze?',
    ],
  },
  skalierung: {
    threadId: 'skalierung',
    checkpoint: 'Welche Pilotannahme könnte außerhalb des Piloten nicht mehr gelten?',
    conversationSteps: ['Annahmen', 'Übertragbarkeit', 'Betrieb', 'Rollout'],
    recognitionExamples: [
      'Der Pilot war erfolgreich. Würden Sie sofort global ausrollen?',
      'Was muss geprüft werden, bevor Sie von 50 auf 5.000 Nutzer skalieren?',
      'Wie stellen Sie sicher, dass ein Pilot im Rollout funktioniert?',
    ],
  },
  'stakeholder-change': {
    threadId: 'stakeholder-change',
    checkpoint: 'Warum gibt es Widerstand – was ist die tatsächliche Ursache?',
    conversationSteps: ['Ursache', 'Beteiligung', 'Befähigung', 'Verankerung'],
    recognitionExamples: [
      'Der Fachbereich blockiert ein neues KI-Tool. Wie gehen Sie vor?',
      'Mitarbeiter nutzen das neue System nicht. Was tun Sie?',
      'Wie gehen Sie mit Widerstand gegen Automatisierung um?',
    ],
  },
  'stakeholder-konflikt': {
    threadId: 'stakeholder-konflikt',
    checkpoint: 'Welche Interessen oder Entscheidungsrechte kollidieren wirklich?',
    conversationSteps: ['Interessen', 'Konfliktkern', 'Optionen', 'Einigung'],
    recognitionExamples: [
      'IT und Fachbereich sind sich über die Verantwortung uneinig. Wie lösen Sie das?',
      'Zwei Stakeholder verfolgen gegensätzliche Ziele. Was tun Sie?',
      'Management und Compliance bewerten ein KI-Projekt unterschiedlich. Wie gehen Sie damit um?',
    ],
  },
  'risiko-governance': {
    threadId: 'risiko-governance',
    checkpoint: 'Was kann schiefgehen, wie gravierend ist es und wer muss eingreifen können?',
    conversationSteps: ['Risiko', 'Verantwortung', 'Kontrolle', 'Eskalation'],
    recognitionExamples: [
      'Ein KI-System trifft Entscheidungen mit Kundenauswirkung. Welche Kontrollen brauchen Sie?',
      'Wer trägt die Verantwortung bei einer KI-Fehlentscheidung?',
      'Wann brauchen Sie Human Oversight?',
    ],
  },
  wirkung: {
    threadId: 'wirkung',
    checkpoint: 'Woran belege ich gegenüber einer Baseline, dass Unternehmenswert entstanden ist?',
    conversationSteps: ['Baseline', 'KPI', 'Messung', 'Business Value'],
    recognitionExamples: [
      'Wie stellen Sie sicher, dass ein KI-Projekt messbaren Business Value erzeugt?',
      'Woran messen Sie den Erfolg eines Piloten?',
      'Reicht gefühlte Zeitersparnis als Erfolgsnachweis?',
    ],
  },
  priorisierung: {
    threadId: 'priorisierung',
    checkpoint: 'Was ist wichtiger als was – und warum?',
    conversationSteps: ['Kriterien', 'Vergleich', 'Trade-off', 'Reihenfolge'],
    recognitionExamples: [
      'Sie haben Budget nur für einen von drei Use Cases. Welchen wählen Sie?',
      'Wie priorisieren Sie eine KI-Roadmap?',
      'Hohes Potenzial, aber schlechte Datenlage – trotzdem priorisieren?',
    ],
  },
  'star-l': {
    threadId: 'star-l',
    checkpoint: 'Welches eigene Urteil und Verhalten will ich mit diesem Beispiel zeigen?',
    conversationSteps: ['Situation', 'Task', 'Action', 'Result', 'Learning'],
    recognitionExamples: [
      'Erzählen Sie von einem Projekt, das nicht wie geplant lief.',
      'Beschreiben Sie einen Konflikt, den Sie gelöst haben.',
      'Nennen Sie eine schwierige Entscheidung und was Sie daraus gelernt haben.',
    ],
  },
}

export function getAnswerGuide(threadId: string): AnswerGuide {
  const guide = answerGuides[threadId]
  if (!guide) throw new Error(`Kein Gesprächsleitfaden für roten Faden: ${threadId}`)
  return guide
}
