# Rote Pfade

Eine clientseitige React-Anwendung, die kurze Satzfragmente oder vollständige Interviewfragen einem passenden Antwortmuster zuordnet.

## Ziel

Die App unterstützt insbesondere Interviews für Rollen wie:

- AI Business Architect
- AI Product Owner
- Strategiemanager
- Senior Consultant
- KI-Transformation und Prozessmanagement

Die Klassifikation wird nicht an ein externes LLM oder Backend übertragen. Die Zuordnung erfolgt im Browser über gewichtete Signale, Wort- und Beispielähnlichkeit sowie transparente Regeln.

## Funktionen

- Texteingabe und Diktat über die Windows-Funktion `Win + H`
- Hauptfaden und zwei alternative Zuordnungen
- fachliche Varianten, zum Beispiel Make-or-Buy, Anbieterauswahl oder Prozessanalyse
- kompakte, nummerierte Antwortschritte
- Kennzeichnung als klare, mehrdeutige oder schwach belegte Zuordnung
- 14 konsolidierte rote Fäden
- Trainingsmodus mit lokaler Statistik
- durchsuchbare Fadenbibliothek einschließlich Varianten
- lokale Korrektur von Faden und Variante
- erneute Verwendung einer Korrektur bei derselben normalisierten Eingabe
- JSON-Export und -Import der lokalen Daten
- isoliertes Speech-Lab für reproduzierbare Browser-ASR-Diagnosen
- automatisches Deployment über GitHub Pages

Lokale Korrekturen sind deterministische Overrides für identische Eingaben. Es findet kein Modelltraining statt und ähnliche, aber nicht identische Eingaben werden nicht automatisch verändert.

## Produktiver Spracheingabe-Workflow

Die App enthält bewusst keinen produktiven Mikrofonbutton mehr. Die bisherigen Browser-Lösungen waren auf der getesteten Zielhardware entweder nicht verfügbar oder qualitativ und zeitlich unzureichend.

Der belastbare Sofortweg unter Windows ist:

1. Im Bereich **Erkennen** das Textfeld fokussieren.
2. `Win + H` drücken.
3. Die Frage diktieren.
4. Diktat beenden und Enter drücken.
5. Die vorhandene Klassifikation läuft unverändert.

Die Windows-Diktierfunktion ist vom App-Code getrennt. Ihre Verarbeitung und Datenschutzbedingungen richten sich nach Windows-, Konto- und Unternehmensrichtlinien; die App behauptet dafür keine lokale Verarbeitung.

## Speech-Lab

Das Speech-Lab ist ein Diagnosebereich und kein produktiver Eingabepfad. Es wird erst über das Menü geöffnet. Die schweren Modellartefakte werden nicht für den normalen Klassifikationsworkflow benötigt.

### Ziel

Das Lab beantwortet reproduzierbar drei Fragen:

1. Ist der von `MediaRecorder` erzeugte Blob technisch intakt?
2. Ist das exakt an Whisper übergebene 16-kHz-PCM hörbar und vollständig?
3. Welche Modell-/Backend-Konfiguration erreicht auf der Zielhardware die geforderte Qualität und Latenz?

### Audio-Validierung

Eine Aufnahme wird vor jedem Modelltest geprüft auf:

- Blob-Größe und MIME-Typ
- Anzahl der von `MediaRecorder` gelieferten Chunks
- reale und dekodierte Dauer
- Abweichung zwischen realer und dekodierter Dauer
- gemeldete Capture-Samplerate
- Dekodierungs-Samplerate und Kanalzahl
- Anzahl der PCM-Samples
- RMS-Pegel und Peak
- Anteil praktisch leerer Samples
- Stille am Anfang und Ende

Die Rohaufnahme und das tatsächlich getestete 16-kHz-PCM werden getrennt als Audio-Player angeboten. Modelltests sind blockiert, solange die Aufnahme technisch ungeeignet ist.

### Reproduzierbarer Modellvergleich

Jede gewählte Konfiguration erhält exakt dasselbe PCM zweimal:

1. erster Lauf einschließlich Backend-Aufwärmung
2. zweiter Lauf mit bereits warmem Modell

Enthalten sind:

- explizite Baseline: Whisper Base q4/q4 über WebGPU
- Whisper Base q8/q8 über WebGPU
- Whisper Base FP16/q8 über WebGPU
- optional Whisper Tiny q8 über WebGPU als Größenreferenz
- optional Whisper Tiny q8 über WASM als Backend-Referenz

Es gibt keinen automatischen Fallback zwischen Profilen. Fehler und Ergebnisse bleiben pro Profil sichtbar.

### Harte Abnahmekriterien

Für eine belastbare Referenz muss die Aufnahme 3 bis 12 Sekunden lang sein.

Eine Konfiguration besteht nur, wenn der warme Lauf gleichzeitig erfüllt:

- Inferenzzeit höchstens 1,5 Sekunden
- Echtzeitfaktor höchstens 0,5
- Word Error Rate höchstens 15 Prozent

Wenn bereits die warme q4/q4-Baseline mehr als 3 Sekunden benötigt, beendet das Lab die Testreihe. Dann gilt der Browser-Ansatz auf dieser Hardware als verworfen; weitere Modellvarianten werden nicht automatisch durchprobiert.

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

1. exakte und normalisierte Cue-Treffer
2. tokenbasierte Abdeckung natürlich formulierter Varianten
3. Ähnlichkeit zu anonymisierten Beispielen
4. positive und negative Signale
5. fachliche Varianten innerhalb eines Fadens
6. lokal bestätigte Overrides bei identischen normalisierten Eingaben

Die Ausgabe ist eine nachvollziehbare Heuristik und keine statistisch kalibrierte Wahrscheinlichkeit. Bei geringem Abstand zwischen zwei Kandidaten wird die Zuordnung als mehrdeutig gekennzeichnet. Bei wenig Evidenz wird dies ebenfalls sichtbar gemacht.

## Lokal starten

```bash
npm install
npm run dev
```

Mikrofonzugriff, WebGPU und WASM benötigen einen sicheren Kontext. `localhost` und GitHub Pages erfüllen diese Voraussetzung.

## Test und Build

```bash
npm run test:run
npm run build
```

Die Regressionstests enthalten mehr als 50 kurze und vollständige Intervieweingaben. Zusätzlich werden Varianten, schwache Evidenz, lokale Overrides, Word Error Rate, Audioqualitäts-Gates, Dauerprüfung und das q4-Abbruchkriterium geprüft.

Pull Requests und Feature-Branches werden über `.github/workflows/validate.yml` getestet und gebaut. Pushes auf `main` werden über `.github/workflows/deploy.yml` getestet, gebaut und auf GitHub Pages veröffentlicht.

## GitHub Pages

Einmalig in GitHub konfigurieren:

1. Repository unter **Settings → Pages** öffnen.
2. Unter **Build and deployment** als Source **GitHub Actions** auswählen.
3. Falls GitHub Pages im privaten Repository nicht verfügbar ist, das Repository auf **Public** stellen.

Danach ist die Anwendung unter folgender URL erreichbar:

`https://satte882.github.io/Rote-Pfade/`

## Daten und Datenschutz

- Die reguläre Klassifikation verarbeitet Fragen im Browser.
- Fragen, Transkripte und lokale Korrekturen bleiben im jeweiligen Browser.
- Exportdateien enthalten nur lokal gespeicherte Zuordnungen und Trainingsstatistiken.
- Das Speech-Lab hält Audio nur für die aktuelle Browsersitzung und speichert es nicht in der App-Datenablage.
- Beim Start eines Speech-Lab-Modelltests werden Modellartefakte von Hugging Face geladen und im Browsercache gespeichert.
- Das Speech-Lab sendet die aufgenommene Audiodatei nicht an Hugging Face oder ein App-Backend.
- Die Windows-Diktierfunktion ist ein externer Betriebssystemdienst und unterliegt den Windows-Richtlinien.
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
