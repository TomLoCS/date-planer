import type { Place, SearchParams } from '../types';
import { CATEGORY_BY_ID, condsToOverpass, matchCategory, type Category } from '../data/categories';

/**
 * Notlösung, wenn Geoapify nicht geht (kein Key, Tageslimit): direkt die öffentlichen Overpass-Server fragen.
 * Kostenlos und ohne Key, aber oft langsam/überlastet. Fällt einer aus, wird der nächste probiert;
 * der zuletzt erfolgreiche Server wird beim nächsten Mal zuerst gefragt.
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

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildQuery({ center, radius, categoryIds }: SearchParams): string {
  const around = `(around:${radius},${center.lat.toFixed(5)},${center.lon.toFixed(5)})`;
  const lines: string[] = [];
  for (const id of categoryIds) {
    const cat = CATEGORY_BY_ID[id];
    if (!cat) continue;
    const name = cat.requireName === false ? '' : '["name"]';
    for (const conds of cat.match) {
      lines.push(`  nwr${condsToOverpass(conds)}${name}["access"!~"^(private|no)$"]${around};`);
    }
  }
  return `[out:json][timeout:25];\n(\n${lines.join('\n')}\n);\nout center tags;`;
}

export async function fetchOverpass(
  params: SearchParams,
  signal?: AbortSignal,
  onAttempt?: (attempt: number, total: number) => void,
): Promise<Place[]> {
  const query = buildQuery(params);
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
      rememberEndpoint(endpoint);
      return parseOverpass(json.elements, params.categoryIds);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = `${new URL(endpoint).host}: ${timeout.aborted ? 'keine Antwort' : (err as Error).message}`;
    }
  }
  throw new Error(`Die kostenlosen Kartenserver sind gerade ausgelastet. Bitte gleich nochmal versuchen. (${lastError})`);
}

/** Overpass-Elemente → Orte. Wird auch für die Demo-Daten benutzt. */
export function parseOverpass(elements: OverpassElement[], categoryIds: string[]): Place[] {
  const candidates: Category[] = categoryIds.map((id) => CATEGORY_BY_ID[id]).filter(Boolean);
  const nearWater = new Set<string>();
  const byId = new Map<string, Place>();

  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    // Elemente ohne Tags = Liste „liegt am Wasser" (nur in den Demo-Daten)
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

  const places = [...byId.values()];
  for (const p of places) if (nearWater.has(p.id)) p.nearWater = true;
  return places;
}
