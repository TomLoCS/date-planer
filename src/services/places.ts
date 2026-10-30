import type { Place, SearchParams } from '../types';
import { distance } from '../lib/geo';
import { fetchGeoapify, hasGeoapifyKey } from './geoapify';
import { fetchOverpass, parseOverpass, type OverpassElement } from './overpass';
import { findNearWater } from './water';

/**
 * Einstieg für alle Orts-Daten. Die App fragt nur hier – welche Quelle dahinter steckt, entscheidet diese Datei:
 * 1. `?demo` in der URL → fiktive Testorte
 * 2. Zwischenspeicher (24 h) → spart Geoapify-Credits beim Neuladen
 * 3. Geoapify → schnell, braucht API-Key
 * 4. Overpass → Notlösung ohne Key, aber oft langsam
 */
const MAX_PLACES = 800;

/** `?demo` in der URL → fiktive Beispiel-Orte (zum Testen ohne Server) */
export function isDemoMode(): boolean {
  return new URLSearchParams(location.search).has('demo');
}

export async function fetchPlaces(params: SearchParams, signal?: AbortSignal, onStatus?: (text: string) => void): Promise<Place[]> {
  if (params.categoryIds.length === 0) return [];
  if (isDemoMode()) {
    const { DEMO_ELEMENTS } = await import('../dev/demoData');
    const all = parseOverpass(DEMO_ELEMENTS as unknown as OverpassElement[], params.categoryIds);
    return finish(all, params).filter((p) => distance(params.center, p) <= params.radius);
  }

  const key = cacheKey(params);
  const cached = readCache(key);
  if (cached) return cached;

  let places: Place[];
  if (hasGeoapifyKey()) {
    try {
      places = await fetchGeoapify(params, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(err);
      const reason = (err as Error).message;
      places = await fetchOverpass(params, signal, (a) => onStatus?.(`${reason} – frage OSM-Server ${a} …`));
    }
  } else {
    places = await fetchOverpass(params, signal, (a) => onStatus?.(a > 1 ? `Server überlastet – Ausweichserver ${a} …` : 'Suche Orte …'));
  }

  const result = finish(places, params);
  writeCache(key, result);
  return result;
}

/** IDs der Orte, die am Wasser liegen (für das Kriterium 🌊) */
export async function checkNearWater(places: Place[], signal?: AbortSignal): Promise<Set<string>> {
  if (isDemoMode()) return new Set(places.filter((p) => p.nearWater).map((p) => p.id));
  return findNearWater(places, signal);
}

/** Doppelte entfernen, nach Entfernung sortieren, begrenzen */
function finish(places: Place[], { center }: SearchParams): Place[] {
  return dedupe(places)
    .sort((a, b) => distance(center, a) - distance(center, b))
    .slice(0, MAX_PLACES);
}

/** Gleicher Name + gleiche Kategorie innerhalb von 80 m = derselbe Ort (z. B. Punkt + Gebäude). */
function dedupe(places: Place[]): Place[] {
  const seen = new Map<string, Place[]>();
  const out: Place[] = [];
  for (const p of places) {
    const key = `${p.categoryId}|${p.name.toLowerCase()}`;
    const same = seen.get(key) ?? [];
    if (same.some((q) => distance(p, q) < 80)) continue;
    same.push(p);
    seen.set(key, same);
    out.push(p);
  }
  return out;
}

// --- Zwischenspeicher im localStorage: die letzten Suchen, 24 h gültig ---
const CACHE_KEY = 'dp.placeCache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_ENTRIES = 6;

interface CacheEntry {
  key: string;
  time: number;
  places: Place[];
}

function cacheKey({ center, radius, categoryIds }: SearchParams): string {
  return `${center.lat.toFixed(4)},${center.lon.toFixed(4)}|${radius}|${[...categoryIds].sort().join(',')}`;
}

function cacheEntries(): CacheEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as CacheEntry[];
    return list.filter((e) => Date.now() - e.time < CACHE_TTL_MS);
  } catch {
    return [];
  }
}

function readCache(key: string): Place[] | undefined {
  return cacheEntries().find((e) => e.key === key)?.places;
}

function writeCache(key: string, places: Place[]) {
  const list = [{ key, time: Date.now(), places }, ...cacheEntries().filter((e) => e.key !== key)].slice(0, CACHE_ENTRIES);
  // Speicher voll → ältere Einträge weglassen, bis es passt
  for (let n = list.length; n > 0; n--) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, n)));
      return;
    } catch {
      // weiter mit weniger Einträgen
    }
  }
}
