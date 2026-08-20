# Antwortmodell: Roter Pfad + entscheidender Prüfpunkt

## Ziel

Die App soll im Interview nicht zwei Frameworks nacheinander abfragen, sondern eine lineare Antwort vorbereiten:

**Interviewfrage → Fragetyp erkennen → entscheidenden Prüfpunkt setzen → Schritte entlanggehen → Position → Begründung / Trade-off → Konsequenz → STOP**

## Rollen der Elemente

| Element | Leitfrage | Funktion |
| --- | --- | --- |
| Roter Pfad | Wie denke ich diese Frage durch? | liefert die Denkstruktur |
| Entscheidender Prüfpunkt | Worauf muss ich innerhalb dieses Pfades besonders achten? | fokussiert die Denkstruktur auf den konkreten Fall |
| Management-Hebel | Welches fachliche Prinzip erklärt den Fokus? | Hintergrundwissen für Lernen und Begründung, kein eigener Antwortschritt |
| Gesprochene Antwort | Was ist meine Position und warum? | Position → Begründung / Trade-off → Konsequenz → STOP |

## Wichtigste Regel

Der Management-Hebel ist **kein eigener Schritt der gesprochenen Antwort**. Er kann erklären, warum ein bestimmter Prüfpunkt relevant ist. Im Gespräch wird anschließend linear entlang des roten Pfades argumentiert.

Beispiel:

- Frage: „Ihr Pilot läuft technisch reibungslos, aber niemand nutzt das Tool. Was tun Sie?“
- Roter Pfad: **Problem / Störung**
- Prüfpunkt: **Welche zentrale Erwartung wird verletzt – und ist die Ursache behebbar?**
- Schritte: **Symptom → Ursache → Maßnahme → Wirkung**
- Management-Hintergrund: **Pilotierung – zentrale offene Annahme gezielt prüfen**
- Gesprochen: **Position → entlang der Schritte begründen → Konsequenz → STOP**

## Produktmodi

### Erkennen

Live-Unterstützung im Gespräch. Ausgabe:

1. Roter Pfad
2. Entscheidender Prüfpunkt
3. kompakte Gesprächsschritte
4. Erinnerung an das gesprochene Antwortschema

### Training – Üben

Trainiert den schnellen Abruf:

1. Interviewfrage lesen
2. roten Pfad auswählen
3. Prüfpunkt und Gesprächsschritte abrufen
4. Antwort selbst laut formulieren

Der Management-Hebel wird nur noch als optionaler fachlicher Hintergrund gezeigt.

### Training – Lernen

Erklärt die Verbindung:

1. Roter Pfad
2. entscheidender Prüfpunkt
3. kompakte Gesprächsschritte
4. ausführliche Denkstruktur mit Leitfragen
5. fachlicher Management-Hintergrund

### Fäden

Nachschlagewerk mit:

- Ziel des Fadens
- entscheidendem Prüfpunkt
- kompakten Gesprächsschritten
- ausführlicher Denkstruktur
- typischen Interviewfragen zur schnellen Zuordnung

## Datenmodell

Die kompakte Gesprächslogik liegt bewusst getrennt von der Klassifikationswissensbasis in `src/data/answer-guides.ts`.

Damit bleiben zwei Ebenen erhalten:

- bestehende Thread-JSONs: ausführliche Erkennungs- und Lernlogik
- `answer-guides.ts`: Gesprächsprojektion mit Prüfpunkt, kompakten Schritten und Zuordnungsbeispielen

Die Trennung verhindert, dass kompakte Live-Schritte die ausführlichen Lern- oder Klassifikationsdaten ersetzen.
