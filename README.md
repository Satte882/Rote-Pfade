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

Der kompakte Ablauf ist:

1. Mikrofon anklicken.
2. Die Aufnahme startet sofort; parallel wird Whisper im Worker vorbereitet.
3. Interviewfrage sprechen.
4. Enter drücken oder den Stopp-Button anklicken.
5. Die Aufnahme läuft noch 300 ms weiter, damit das Satzende nicht abgeschnitten wird.
6. Audio wird lokal auf Mono mit 16 kHz normalisiert und auf Pegel, Stille sowie Übersteuerung geprüft.
7. Whisper transkribiert im Web Worker.
8. Das Transkript wird in das Eingabefeld eingesetzt und automatisch klassifiziert.
9. Der Text bleibt editierbar und kann mit Enter erneut klassifiziert werden.

Die Transkription nutzt `@huggingface/transformers` und folgende definierte Profilkette:

1. Standard: `onnx-community/whisper-base` über WebGPU mit FP16-Encoder und q8-Decoder.
2. Technischer Fallback bei Initialisierungs- oder Inferenzfehlern: dasselbe Base-Modell mit q8/q8 über WebGPU.
3. Letzter Fallback: `onnx-community/whisper-tiny` mit q8 über WASM/CPU.

Eine lediglich langsame FP16-Inferenz löst keinen stillen Qualitäts-Downgrade aus. Erst wenn mindestens zwei geeignete, bereits vorgewärmte Folgeaufnahmen sowohl mindestens 3,5 Sekunden Inferenzzeit als auch einen medianen Echtzeitfaktor von mindestens 1,25 erreichen, empfiehlt die App sichtbar einen Test mit q8/q8. Der Nutzer kann danach ebenso sichtbar zu FP16/q8 zurückkehren.

Die Verarbeitung von Audio und Transkript erfolgt im Browser. Beim ersten Einsatz werden die benötigten Modellartefakte und ONNX-Runtime-Dateien von Hugging Face beziehungsweise den von Transformers.js verwendeten Quellen geladen. Danach verwendet Transformers.js den Cache-API-Speicher `transformers-cache`. Die Anwendung fragt zusätzlich persistenten Browserspeicher an; der Browser kann diesen Wunsch ablehnen oder gespeicherte Daten später entfernen.

Die Sprachdiagnose zeigt unter anderem:

- aktives Modellprofil und Backend,
- Gesamtzeit nach Enter,
- Audioaufbereitung,
- Wartezeit auf das Modell,
- reine Inferenzzeit und Echtzeitfaktor,
- Audioqualität und mittleren Pegel,
- Cache- und Persistenzstatus.

Wird ein bereits erfolgreich geladener Modellcache mindestens zweimal nach einem Browserneustart leer vorgefunden, wird der Cache als unzuverlässig gekennzeichnet. Der Eskalationspfad ist dann: Website als App installieren oder die Website in den Browser-Einstellungen vom automatischen Löschen der Websitedaten ausnehmen. Ein Service Worker wird nicht vorsorglich eingebaut, weil Transformers.js Modelle und WASM bereits selbst über die Cache API verwaltet.

Es werden bewusst keine festen Aussagen zu Downloadgröße oder Geschwindigkeit gemacht. Modellinitialisierung und Transkriptionsdauer hängen von Modellartefakten, Browser, WebGPU-Verfügbarkeit, CPU/GPU und Aufnahmelänge ab.

### Tastaturverhalten

| Zustand | Enter | Escape |
|---|---|---|
| Texteingabe | klassifizieren | Eingabe und Ergebnis löschen |
| Aufnahme läuft | 300-ms-Nachlauf starten, dann transkribieren | Aufnahme verwerfen |
| Audioaufbereitung läuft | keine Aktion | Verarbeitung verwerfen |
| Modellladen oder Transkription | keine Aktion | Ergebnis verwerfen |
| Ergebnis sichtbar | erneut klassifizieren | Eingabe und Ergebnis löschen |

Eine laufende Whisper-Inferenz wird bei Escape nicht technisch mitten im Rechenschritt beendet. Das Ergebnis wird verworfen und der Worker beendet die Restverarbeitung, damit das geladene Modell im Arbeitsspeicher erhalten bleibt.

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

Mikrofonzugriff, WebGPU und persistenter Browsercache benötigen einen sicheren Kontext. `localhost` und GitHub Pages erfüllen diese Voraussetzung.

## Test und Build

```bash
npm run test:run
npm run build
```

Die Regressionstests enthalten mehr als 50 kurze und vollständige Intervieweingaben aus Strategie, KI, Digitalisierung, Produkt-, Prozess- und Transformationskontexten. Zusätzlich werden Varianten, schwache Evidenz, lokale Overrides, Kanal-Mischung, 16-kHz-Resampling, Audioqualitäts-Gates und die Performance-Empfehlungsregel geprüft.

Pull Requests und Feature-Branches werden über `.github/workflows/validate.yml` getestet und gebaut. Pushes auf `main` werden über `.github/workflows/deploy.yml` getestet, gebaut und auf GitHub Pages veröffentlicht.

### Manueller Browser-Test für Spracheingabe

Der Produktions-Build prüft TypeScript, Worker-Bundling und statische Assets. Mikrofon, Modell-Download und Hardware-Backends müssen zusätzlich im echten Browser geprüft werden:

1. erste Aufnahme mit WebGPU und leerem Modellcache,
2. zweite Aufnahme in derselben Sitzung,
3. Browser schließen und erneut öffnen,
4. prüfen, ob der Cache erhalten blieb,
5. Offline-Modus nach erfolgreichem Modelldownload,
6. technischer FP16-Fehlerpfad auf q8/q8,
7. WASM-Fallback ohne WebGPU,
8. Aufnahme mit 5 bis 15 Sekunden Länge,
9. Escape während Aufnahme und während Transkription,
10. Transkript korrigieren und erneut mit Enter klassifizieren.

Für einen A/B-Vergleich müssen beide Modellprofile dieselbe Audiodatei erhalten. Als Referenz werden nur Aufnahmen verwendet, welche die eingebaute Audioqualitätsprüfung nicht als ungeeignet markiert. Zehn empfohlene Testfragen sind:

1. Wie würden Sie eine Make-or-Buy-Entscheidung treffen?
2. Wie entwickeln Sie eine KI-Strategie?
3. Wie priorisieren Sie mehrere Use Cases?
4. Wie entscheiden Sie über ein Go oder No-Go?
5. Wie skalieren Sie einen erfolgreichen Piloten?
6. Wie erstellen Sie einen belastbaren Business Case?
7. Wie würden Sie ein Target Operating Model entwickeln?
8. Wie gehen Sie mit Widerstand von Stakeholdern um?
9. Wie prüfen Sie die Anforderungen des EU AI Act?
10. Wie führen Sie einen Proof of Concept in den Betrieb über?

## GitHub Pages

Einmalig in GitHub konfigurieren:

1. Repository unter **Settings → Pages** öffnen.
2. Unter **Build and deployment** als Source **GitHub Actions** auswählen.
3. Falls GitHub Pages im privaten Repository nicht verfügbar ist, das Repository auf **Public** stellen.

Danach ist die Anwendung voraussichtlich unter folgender URL erreichbar:

`https://satte882.github.io/Rote-Pfade/`

## Daten und Datenschutz

- Audio wird nur im Browser gehalten und nach der Aufbereitung nicht dauerhaft gespeichert.
- Fragen, Transkripte und lokale Korrekturen bleiben im jeweiligen Browser.
- Exportdateien enthalten nur die lokal gespeicherten Zuordnungen und Trainingsstatistiken, keine Audioaufnahmen.
- Die öffentliche App enthält ausschließlich generische, anonymisierte Beispiele.
- Private Prompts und Inhalte aus dem Repository `skills` sind nicht eingebunden.
- Der erstmalige Modelldownload ist Netzwerkverkehr; die Audioaufnahme selbst wird nicht an Hugging Face oder ein Backend übertragen.

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
