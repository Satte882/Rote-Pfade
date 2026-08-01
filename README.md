# Rote Pfade

Eine vollständig clientseitige React-Anwendung, die kurze Satzfragmente oder vollständige Interviewfragen einem passenden Antwortmuster zuordnet.

## Ziel

Die App unterstützt insbesondere Interviews für Rollen wie:

- AI Business Architect
- AI Product Owner
- Strategiemanager
- Senior Consultant
- KI-Transformation und Prozessmanagement

Die Eingabe wird nicht an ein externes LLM oder Backend übertragen. Die Zuordnung erfolgt im Browser über gewichtete Signale, Beispielähnlichkeit und transparente Regeln.

## MVP-Funktionen

- Hauptfaden und zwei alternative Zuordnungen
- heuristischer Matchwert mit offengelegten Erkennungssignalen
- Ziel, Antwortschritte, Leitfragen, Merksatz und möglicher Einstieg
- 13 konsolidierte rote Fäden
- anonymisierte, rollenbezogene Interviewbeispiele
- Trainingsmodus mit lokaler Statistik
- durchsuchbare Fadenbibliothek
- lokale Bestätigung und Korrektur von Zuordnungen
- JSON-Export und -Import der lokalen Lerndaten
- automatisches Deployment über GitHub Pages

## Die 13 Fäden

1. Vorgehensfrage
2. Problem- oder Störungsfrage
3. Entscheidungsfrage
4. Entscheidungsfrage unter Unsicherheit
5. KI-Eignungs- oder Use-Case-Frage
6. Vergleichs- und Abgrenzungsfrage
7. Skalierungs- und Transformationsfrage
8. Stakeholder- und Change-Frage
9. Stakeholder-Konflikt- und Moderationsfrage
10. Risiko- und Governance-Frage
11. Wirkungs- und Erfolgsmessungsfrage
12. Priorisierungs- und Portfoliofrage
13. Verhaltens- und Erfahrungsfrage (STAR-L)

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

## GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht die Anwendung bei jedem Push auf `main`.

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
- Antwortschritte und Leitfragen
- positive und negative Erkennungssignale
- anonymisierte Beispiele
- verwandte Fäden
- Merksatz und möglichen Einstieg

Die Anwendung lädt alle JSON-Dateien in diesem Ordner automatisch beim Build.
