import type { LatLon, Place } from '../types';
import { CATEGORY_BY_ID, condsToOverpass, matchCategory, type Category } from '../data/categories';
import { distance } from '../lib/geo';

/**
 * Öffentliche Overpass-Server (kostenlos, Fair Use). Fällt einer aus oder ist überlastet,
 * wird der nächste probiert. Der zuletzt erfolgreiche Server wird beim nächsten Mal zuerst gefragt.
 * Später ggf. durch einen eigenen Server / eigenen POI-Export ersetzen (siehe Obsidian: Tech-Stack & Kosten).
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const PREFERRED_KEY = 'dp.overpassEndpoint';
/** So lange warten wir auf einen Server, bevor der nächste probiert wird */
const ENDPOINT_TIMEOUT_MS = 20_000;

function orderedEndpoints(): string[] {
  let preferred: string | null = null;
  try {
    preferred = localStorage.getItem(PREFERRED_KEY);
  } catch {
    // ohne Speicher einfach Standard-Reihenfolge
  }
  return preferred && ENDPOINTS.includes(preferred) ? [preferred, ...ENDPOINTS.filter((e) => e !== preferred)] : ENDPOINTS;
}

function rememberEndpoint(endpoint: string) {
  try {
    localStorage.setItem(PREFERRED_KEY, endpoint);
  } catch {
    // egal
  }
}

const MAX_PLACES = 800;
const NEAR_WATER_M = 120;

export interface SearchParams {
  center: LatLon;
  radius: number;
  categoryIds: string[];
  /** Nähe zu Wasser mit abfragen (teurer, nur wenn das Kriterium aktiv ist) */
  withWater: boolean;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildQuery({ center, radius, categoryIds, withWater }: SearchParams): string {
  const at = `${center.lat.toFixed(5)},${center.lon.toFixed(5)}`;
  const around = `(around:${radius},${at})`;
  const lines: string[] = [];
  for (const id of categoryIds) {
    const cat = CATEGORY_BY_ID[id];
    if (!cat) continue;
    const name = cat.requireName === false ? '' : '["name"]';
    for (const conds of cat.match) {
      lines.push(`  nwr${condsToOverpass(conds)}${name}["access"!~"^(private|no)$"]${around};`);
    }
  }

  let q = `[out:json][timeout:25];\n(\n${lines.join('\n')}\n)->.all;\n.all out center tags;`;

  if (withWater) {
    // Gewässer etwas über den Suchradius hinaus holen, damit Orte am Rand auch geprüft werden.
    const wa = `(around:${radius + 200},${at})`;
    q += `
(
  way["natural"="water"]["water"!~"^(wastewater|basin)$"]${wa};
  relation["natural"="water"]["water"!~"^(wastewater|basin)$"]${wa};
  way["waterway"~"^(river|canal)$"]${wa};
  way["natural"="coastline"]${wa};
)->.wtmp;
(.wtmp; way(r.wtmp);)->.water;
nwr.all(around.water:${NEAR_WATER_M})->.near;
.near out ids;`;
  }
  return q;
}

const cache = new Map<string, Place[]>();

/** `?demo` in der URL → fiktive Beispiel-Orte statt Overpass (zum Testen ohne Server) */
export function isDemoMode(): boolean {
  return new URLSearchParams(location.search).has('demo');
}

export async function fetchPlaces(
  params: SearchParams,
  signal?: AbortSignal,
  onAttempt?: (attempt: number, total: number) => void,
): Promise<Place[]> {
  if (params.categoryIds.length === 0) return [];
  if (isDemoMode()) {
    const { DEMO_ELEMENTS } = await import('../dev/demoData');
    const all = parse(DEMO_ELEMENTS as unknown as OverpassElement[], params);
    return all.filter((p) => distance(params.center, p) <= params.radius);
  }
  const query = buildQuery(params);
  const cached = cache.get(query);
  if (cached) return cached;

  const endpoints = orderedEndpoints();
  let lastError = '';
  for (const [i, endpoint] of endpoints.entries()) {
    onAttempt?.(i + 1, endpoints.length);
    const timeout = AbortSignal.timeout(ENDPOINT_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!res.ok) {
        lastError = `${new URL(endpoint).host}: HTTP ${res.status}`;
        continue; // 429 (zu viele Anfragen) / 504 (überlastet) → nächster Server
      }
      const json = (await res.json()) as { elements: OverpassElement[]; remark?: string };
      if (json.remark && json.elements.length === 0 && /timed out|runtime error/i.test(json.remark)) {
        lastError = `${new URL(endpoint).host}: ${json.remark}`;
        continue;
      }
      const places = parse(json.elements, params);
      cache.set(query, places);
      rememberEndpoint(endpoint);
      return places;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = `${new URL(endpoint).host}: ${timeout.aborted ? 'keine Antwort' : (err as Error).message}`;
    }
  }
  throw new Error(`Die kostenlosen Kartenserver sind gerade ausgelastet. Bitte gleich nochmal versuchen. (${lastError})`);
}

function parse(elements: OverpassElement[], params: SearchParams): Place[] {
  const candidates: Category[] = params.categoryIds.map((id) => CATEGORY_BY_ID[id]).filter(Boolean);
  const nearWater = new Set<string>();
  const byId = new Map<string, Place>();

  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    // Elemente ohne Tags kommen aus der zweiten Ausgabe (".near out ids") → liegen am Wasser.
    if (!el.tags) {
      nearWater.add(id);
      continue;
    }
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined || byId.has(id)) continue;
    const cat = matchCategory(el.tags, candidates);
    if (!cat) continue;
    byId.set(id, {
      id,
      lat,
      lon,
      name: el.tags.name ?? cat.fallbackName ?? cat.label,
      categoryId: cat.id,
      tags: el.tags,
    });
  }

  const places = dedupe([...byId.values()]);
  if (params.withWater) for (const p of places) p.nearWater = nearWater.has(p.id);

  return places
    .sort((a, b) => distance(params.center, a) - distance(params.center, b))
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
