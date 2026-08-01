# Rote Pfade

Eine vollständig clientseitige React-Anwendung, die kurze Satzfragmente oder vollständige Interviewfragen einem passenden Antwortmuster zuordnet.

## Ziel

Die App unterstützt insbesondere Interviews für Rollen wie:

- AI Business Architect
- AI Product Owner
- Strategiemanager
- Senior Consultant
- KI-Transformation und Prozessmanagement

Die Klassifikation wird nicht an ein externes LLM oder Backend übertragen. Die Zuordnung erfolgt im Browser über gewichtete Signale, Wort- und Beispielähnlichkeit sowie transparente Regeln.

## Funktionen

- Texteingabe oder lokale Spracheingabe über das Mikrofon
- Hauptfaden und zwei alternative Zuordnungen
- fachliche Varianten innerhalb eines Fadens, zum Beispiel Make-or-Buy, Anbieterauswahl oder Prozessanalyse
- kompakte, nummerierte Antwortschritte
- Kennzeichnung als klare, mehrdeutige oder schwach belegte Zuordnung
- 14 konsolidierte rote Fäden
- anonymisierte, rollenbezogene Interviewbeispiele
- Trainingsmodus mit lokaler Statistik
- durchsuchbare Fadenbibliothek einschließlich Varianten
- lokale Korrektur von Faden und Variante
- erneute Verwendung einer Korrektur bei derselben normalisierten Eingabe
- JSON-Export und -Import der lokalen Daten
- automatisches Deployment über GitHub Pages

Lokale Korrekturen sind deterministische Overrides für identische Eingaben. Es findet kein Modelltraining statt und ähnliche, aber nicht identische Eingaben werden nicht automatisch verändert.

## Spracheingabe

Die App verwendet die lokale SpeechRecognition-Funktion des Browsers mit `processLocally = true` und der Sprache `de-DE`.

Der Ablauf ist:

1. Mikrofon anklicken.
2. Verfügbarkeit des lokalen deutschen Sprachmodells prüfen.
3. Das Sprachpaket bei Bedarf einmalig über den Browser installieren.
4. Frage sprechen.
5. Enter drücken oder den Stopp-Button anklicken.
6. Das lokale Browsermodell liefert das Transkript.
7. Das Transkript wird automatisch klassifiziert und bleibt editierbar.

Es gibt keinen Cloud-Fallback und keinen Whisper-Worker mehr. Ist verbindlich lokale Erkennung nicht verfügbar, zeigt die App einen Fehler statt Audio an einen externen Dienst zu senden.

### Voraussetzung

Der Zielbrowser ist Microsoft Edge mit Unterstützung für lokale SpeechRecognition. In Edge-Versionen, in denen die Funktion noch hinter einem Schalter liegt, muss unter `edge://flags` die Option **Speech Recognition with on-device model** aktiviert werden.

### Tastaturverhalten

| Zustand | Enter | Escape |
|---|---|---|
| Texteingabe | klassifizieren | Eingabe und Ergebnis löschen |
| Aufnahme läuft | lokale Erkennung abschließen | Aufnahme verwerfen |
| Sprachpaket wird geprüft oder installiert | keine Aktion | Vorgang verwerfen |
| Ergebnis sichtbar | erneut klassifizieren | Eingabe und Ergebnis löschen |

## Die 14 Fäden

1. Vorgehensfrage
2. Strategie- und Zielbildfrage
3. Problem- oder Störungsfrage
4. Entscheidungsfrage
5. Entscheidungsfrage unter Unsicherheit
6. KI-Eignungs- oder Use-Case-Frage
7. Vergleichs- und Abgrenzungsfrage
8. Skalierungs- und Transformationsfrage
9. Stakeholder- und Change-Frage
10. Stakeholder-Konflikt- und Moderationsfrage
11. Risiko- und Governance-Frage
12. Wirkungs- und Erfolgsmessungsfrage
13. Priorisierungs- und Portfoliofrage
14. Verhaltens- und Erfahrungsfrage (STAR-L)

## Fachliche Varianten

Ein Top-Level-Faden kann mehrere konkrete Antwortmuster besitzen. Aktuell sind unter anderem enthalten:

- Entscheidungsfrage
  - Make-or-Buy
  - Anbieter- oder Toolauswahl
  - Pilot fortführen, nachschärfen oder stoppen
- Vorgehensfrage
  - strukturierte Prozessanalyse
  - Projekt- oder Initiativenstart
  - von der Idee zur umsetzbaren Lösung

Die Variante wird aus eigenen Signalen und Beispielen bestimmt. Gibt es keine ausreichend belastbare Variante, bleibt die allgemeine Schrittfolge des Fadens aktiv.

## Erkennungslogik

Die Klassifikation kombiniert:

1. exakte und normalisierte Cue-Treffer,
2. tokenbasierte Abdeckung natürlich formulierter Varianten,
3. Ähnlichkeit zu anonymisierten Beispielen,
4. positive und negative Signale,
5. fachliche Varianten innerhalb eines Fadens,
6. lokal bestätigte Overrides bei identischen normalisierten Eingaben.

Die Ausgabe ist eine nachvollziehbare Heuristik und keine statistisch kalibrierte Wahrscheinlichkeit. Bei geringem Abstand zwischen zwei Kandidaten wird die Zuordnung als mehrdeutig gekennzeichnet. Bei wenig Evidenz wird dies ebenfalls sichtbar gemacht.

## Lokal starten

```bash
npm install
npm run dev
```

Mikrofonzugriff und lokale SpeechRecognition benötigen einen sicheren Kontext. `localhost` und GitHub Pages erfüllen diese Voraussetzung.

## Test und Build

```bash
npm run test:run
npm run build
```

Die Regressionstests enthalten mehr als 50 kurze und vollständige Intervieweingaben aus Strategie, KI, Digitalisierung, Produkt-, Prozess- und Transformationskontexten. Zusätzlich werden Varianten, schwache Evidenz und lokale Overrides geprüft.

Pull Requests und Feature-Branches werden über `.github/workflows/validate.yml` getestet und gebaut. Pushes auf `main` werden über `.github/workflows/deploy.yml` getestet, gebaut und auf GitHub Pages veröffentlicht.

### Manueller Browser-Test für Spracheingabe

1. Edge-Version prüfen.
2. Falls erforderlich `edge://flags` öffnen und **Speech Recognition with on-device model** aktivieren.
3. Seite neu starten und Mikrofon anklicken.
4. Deutsches Sprachpaket installieren lassen, falls die App dies meldet.
5. „Wie würden Sie eine Make-or-Buy-Entscheidung treffen?“ sprechen.
6. Enter drücken.
7. Transkript und Make-or-Buy-Faden prüfen.
8. Browser offline schalten und eine zweite Frage testen.
9. Escape während der Aufnahme prüfen.

## GitHub Pages

Einmalig in GitHub konfigurieren:

1. Repository unter **Settings → Pages** öffnen.
2. Unter **Build and deployment** als Source **GitHub Actions** auswählen.
3. Falls GitHub Pages im privaten Repository nicht verfügbar ist, das Repository auf **Public** stellen.

Danach ist die Anwendung voraussichtlich unter folgender URL erreichbar:

`https://satte882.github.io/Rote-Pfade/`

## Daten und Datenschutz

- Die lokale SpeechRecognition verarbeitet Audio auf dem Gerät.
- Es gibt keinen Cloud-Fallback.
- Fragen, Transkripte und lokale Korrekturen bleiben im jeweiligen Browser.
- Exportdateien enthalten nur die lokal gespeicherten Zuordnungen und Trainingsstatistiken, keine Audioaufnahmen.
- Die öffentliche App enthält ausschließlich generische, anonymisierte Beispiele.
- Private Prompts und Inhalte aus dem Repository `skills` sind nicht eingebunden.

## Wissensbasis erweitern

Neue Fäden werden als einzelne JSON-Dateien unter `src/data/threads/` ergänzt. Jeder Faden enthält unter anderem:

- Zweck und Beschreibung
- allgemeine Antwortschritte und Leitfragen
- positive und negative Erkennungssignale
- anonymisierte Beispiele
- verwandte Fäden
- Merksatz und möglichen Einstieg
- optional fachliche Varianten mit eigenen Schritten, Signalen und Beispielen

Die Anwendung lädt alle JSON-Dateien in diesem Ordner automatisch beim Build. Ein neuer Faden muss zusätzlich in `THREAD_ORDER` in `src/lib/classifier.ts` einsortiert und durch Regressionstests abgesichert werden.
