# Rote Pfade

Eine vollständig clientseitige React-Anwendung, die kurze Satzfragmente oder vollständige Interviewfragen einem passenden Antwortmuster zuordnet.

## Ziel

Die App unterstützt insbesondere Interviews für Rollen wie:

- AI Business Architect
- AI Product Owner
- Strategiemanager
- Senior Consultant
- KI-Transformation und Prozessmanagement

Die Eingabe wird nicht an ein externes LLM oder Backend übertragen. Die Zuordnung erfolgt im Browser über gewichtete Signale, Wort- und Beispielähnlichkeit sowie transparente Regeln.

## Funktionen

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

## Test und Build

```bash
npm run test:run
npm run build
```

Die Regressionstests enthalten mehr als 50 kurze und vollständige Intervieweingaben aus Strategie, KI, Digitalisierung, Produkt-, Prozess- und Transformationskontexten. Zusätzlich werden Varianten, schwache Evidenz und lokale Overrides geprüft.

Pull Requests und Feature-Branches werden über `.github/workflows/validate.yml` getestet und gebaut. Pushes auf `main` werden über `.github/workflows/deploy.yml` getestet, gebaut und auf GitHub Pages veröffentlicht.

## GitHub Pages

Einmalig in GitHub konfigurieren:

1. Repository unter **Settings → Pages** öffnen.
2. Unter **Build and deployment** als Source **GitHub Actions** auswählen.
3. Falls GitHub Pages im privaten Repository nicht verfügbar ist, das Repository auf **Public** stellen.

Danach ist die Anwendung voraussichtlich unter folgender URL erreichbar:

`https://satte882.github.io/Rote-Pfade/`

## Daten und Datenschutz

- Fragen und lokale Korrekturen bleiben im jeweiligen Browser.
- Exportdateien enthalten nur die lokal gespeicherten Zuordnungen und Trainingsstatistiken.
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
