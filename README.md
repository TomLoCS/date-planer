# 💘 Date Planer

Dates & Freizeit nach Kriterien planen: Kategorien wählen (Essen, Natur, Kultur, Aktiv, Wellness), Kriterien setzen (🐕 Hund, 🥗 vegetarisch, 🌱 vegan, 🌊 am Wasser, ♿ barrierefrei, ☀️ draußen, 💸 kostenlos, 🕐 geöffnet) und passende Orte auf der Karte finden. Daraus einen Plan mit Uhrzeiten bauen, per Link teilen, als Kalender-Datei exportieren oder in Google Maps routen.

**Kosten: 0 €** – OpenStreetMap-Daten über [Geoapify](https://www.geoapify.com/) (Gratis-Kontingent; Notlösung: Overpass), Karte von OpenFreeMap, Ortssuche über Photon, kein Backend.

**Live:** https://tomlocs.github.io/date-planer/ (jeder Push auf `main` wird automatisch über GitHub Pages veröffentlicht)

## Starten

```bash
npm install
cp .env.example .env.local   # Geoapify-Key eintragen
npm run dev                  # http://localhost:5173
npm run build                # statische Seite in dist/
```

- **Geoapify-Key:** gratis unter https://myprojects.geoapify.com. Lokal in `.env.local`, für den Deploy als Repo-Secret `GEOAPIFY_KEY`. Im Geoapify-Dashboard den Key auf die eigenen Domains beschränken (er ist im Browser sichtbar). Ohne Key nutzt die App die langsamen öffentlichen Overpass-Server.
- `http://localhost:5173/?demo` → **Demo-Modus** mit fiktiven Orten (ohne Key und ohne Server).

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/data/categories.ts` | Kategorien → OSM-Tags (hier neue Kategorien eintragen) |
| `src/data/criteria.ts` | Kriterien und ihre Prüf-Logik (ja / nein / unbekannt) |
| `src/services/places.ts` | Einstieg für Ortsdaten: Demo → Cache → Geoapify → Overpass |
| `src/services/geoapify.ts` | Geoapify Places API (eine Anfrage pro Kategorie) |
| `src/services/overpass.ts` | Notlösung: Overpass-Abfrage, Fallback-Server |
| `src/services/water.ts` | „Am Wasser" aus den OpenFreeMap-Kartenkacheln berechnen |
| `src/services/geocode.ts` | Ortssuche (Photon) |
| `src/lib/share.ts` | Plan als Link, Kalender (.ics), Google-Maps-Route |
| `src/lib/surprise.ts` | „Überrasch mich"-Zufalls-Date |
| `src/components/` | Karte, Filter, Liste, Detailkarte, Plan, Favoriten |

Projektdoku & Entscheidungen: Obsidian-Vault → `02 Coding/Apps/Date Planer/Date Planer Hub.md`.

Kartendaten © OpenStreetMap-Mitwirkende (ODbL) · Orte powered by Geoapify.
