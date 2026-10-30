# Date Planer – Hinweise für Claude

## Projektgedächtnis = Obsidian
Das Gedächtnis für dieses Projekt liegt im Obsidian-Vault des Users:
`D:\Obsidian\Erik\02 Coding\Apps\Date Planer\`

- **Vor der Arbeit lesen:** `Date Planer Hub.md`, `Date Planer Devlog.md`, `Date Planer To do.md`
- **Nach der Arbeit pflegen:**
  - neuen Eintrag oben in `Date Planer Devlog.md` (Datum, was gemacht, was offen)
  - `Date Planer To do.md` abhaken / ergänzen
  - neue Entscheidungen mit Begründung in `Date Planer Entscheidungen.md`
  - Status-Zeile im Hub aktualisieren
- Stil der Notizen: Deutsch, YAML-Tags (`Coding`, `App`, `DatePlaner`), Callouts, `[[Wikilinks]]`, „← zurück zum [[Date Planer Hub]]" oben.

## Tech
- React 19 + TypeScript 7 + Vite 8, MapLibre GL 6 (Worker per `setWorkerUrl` in `MapView.tsx` – nicht entfernen).
- Daten: OSM über öffentliche Overpass-Server (Fallback-Liste in `src/services/overpass.ts`), Karte OpenFreeMap, Suche Photon.
- Kein Backend; Zustand in localStorage (`dp.*`-Keys), Pläne werden im URL-Hash `#plan=` geteilt.
- `?demo` in der URL lädt fiktive Testorte (`src/dev/demoData.ts`).
- Prüfen: `npm run typecheck`, `npm run build`. Dev-Server: `.claude/launch.json` → `date-planer`.

## User
Erik, deutschsprachig. Will Bausteine verstehen statt Black-Box, mag modularen Code, Projekt soll erstmal 0 € kosten.
