import type { OsmTags, Place, SearchParams } from '../types';
import { CATEGORY_BY_ID, matchCategory, type Category } from '../data/categories';

/**
 * Geoapify Places API – fertige, schnelle Orte-Suche auf Basis von OpenStreetMap.
 * Gratis-Plan: 3.000 Credits pro Tag, 1 Credit je angefangene 20 gelieferte Orte, max. 5 Anfragen pro Sekunde.
 * Pflicht: sichtbarer Hinweis „Powered by Geoapify" (steht in der Fußzeile und auf der Karte).
 *
 * Der Key steckt zwangsläufig im Browser-Code. Schutz: im Geoapify-Dashboard nur die eigenen Domains erlauben.
 * Lokal steht er in `.env.local`, beim Deploy im GitHub-Secret `GEOAPIFY_KEY`.
 */
const API = 'https://api.geoapify.com/v2/places';
const KEY = (import.meta.env.VITE_GEOAPIFY_KEY ?? '').trim();

/** Orte pro Suche insgesamt – wird auf die gewählten Kategorien verteilt (spart Credits) */
const PLACE_BUDGET = 300;
const PER_CATEGORY_MIN = 30;
const PER_CATEGORY_MAX = 100;
/** Anfragen gleichzeitig; danach kurze Pause wegen „max. 5 pro Sekunde" */
const BATCH_SIZE = 4;
const BATCH_PAUSE_MS = 1_100;
/** Felder, die Geoapify in `raw` selbst ergänzt (Adresse ohne `addr:`-Präfix, Koordinaten, IDs) – keine echten OSM-Tags */
const NOT_OSM_TAGS = new Set(['osm_id', 'osm_type', 'lat', 'lon', 'street', 'housenumber', 'postcode', 'city', 'suburb', 'district', 'state', 'country']);

export const GEOAPIFY_ATTRIBUTION = '<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>';

export function hasGeoapifyKey(): boolean {
  return KEY !== '';
}

/** Antwort-Format von Geoapify (nur die Felder, die wir benutzen) */
interface GeoFeature {
  geometry?: { coordinates?: [number, number] };
  properties: {
    place_id: string;
    name?: string;
    lat?: number;
    lon?: number;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    opening_hours?: string;
    website?: string;
    contact?: { phone?: string; email?: string };
    facilities?: Record<string, boolean | undefined>;
    catering?: { cuisine?: string; diet?: Record<string, boolean | undefined> };
    /** Original-Tags aus OpenStreetMap – damit funktionieren alle Kriterien wie bisher */
    datasource?: { raw?: Record<string, string | number | boolean | null> };
  };
}

export async function fetchGeoapify(params: SearchParams, signal?: AbortSignal): Promise<Place[]> {
  const cats = params.categoryIds.map((id) => CATEGORY_BY_ID[id]).filter(Boolean);
  const limit = Math.min(PER_CATEGORY_MAX, Math.max(PER_CATEGORY_MIN, Math.floor(PLACE_BUDGET / cats.length)));

  // Eine Anfrage pro Kategorie, damit z. B. Restaurants nicht alle Parks verdrängen.
  const results: { cat: Category; features: GeoFeature[] }[] = [];
  for (let i = 0; i < cats.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_PAUSE_MS, signal);
    const batch = cats.slice(i, i + BATCH_SIZE);
    results.push(...(await Promise.all(batch.map(async (cat) => ({ cat, features: await fetchCategory(cat, params, limit, signal) })))));
  }

  const byId = new Map<string, Place>();
  for (const { cat, features } of results) {
    for (const f of features) {
      const place = toPlace(f, cat);
      if (place && !byId.has(place.id)) byId.set(place.id, place);
    }
  }
  return [...byId.values()];
}

async function fetchCategory(cat: Category, { center, radius }: SearchParams, limit: number, signal?: AbortSignal): Promise<GeoFeature[]> {
  const url = new URL(API);
  url.searchParams.set('categories', cat.geoapify.join(','));
  if (cat.requireName !== false) url.searchParams.set('conditions', 'named');
  url.searchParams.set('filter', `circle:${center.lon},${center.lat},${radius}`);
  url.searchParams.set('bias', `proximity:${center.lon},${center.lat}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'de');
  url.searchParams.set('apiKey', KEY);

  let res = await fetch(url, { signal });
  if (res.status === 429) {
    // zu viele Anfragen pro Sekunde → einmal kurz warten und nochmal
    await sleep(BATCH_PAUSE_MS, signal);
    res = await fetch(url, { signal });
  }
  if (!res.ok) throw new Error(errorText(res.status));
  const json = (await res.json()) as { features?: GeoFeature[] };
  return json.features ?? [];
}

function errorText(status: number): string {
  if (status === 401 || status === 403) return 'Geoapify: API-Key ungültig oder für diese Seite nicht freigegeben';
  if (status === 429) return 'Geoapify: Tageslimit erreicht';
  return `Geoapify: Fehler ${status}`;
}

function toPlace(f: GeoFeature, requested: Category): Place | null {
  const p = f.properties;
  const lon = p.lon ?? f.geometry?.coordinates?.[0];
  const lat = p.lat ?? f.geometry?.coordinates?.[1];
  if (lat === undefined || lon === undefined) return null;

  const hasRaw = p.datasource?.raw !== undefined;
  const tags = tagsOf(p);
  if (/^(private|no)$/.test(tags.access ?? '')) return null;
  // Mit OSM-Tags genauso streng prüfen wie bei Overpass (z. B. Kletterhalle = Sportzentrum + sport=climbing)
  const cat = hasRaw ? matchCategory(tags, [requested]) : requested;
  if (!cat) return null;

  return { id: idOf(p), lat, lon, name: tags.name ?? cat.fallbackName ?? cat.label, categoryId: cat.id, tags };
}

/** "node/123" wie in OSM – nötig für Links zu OpenStreetMap und zum Wiedererkennen von Favoriten */
function idOf(p: GeoFeature['properties']): string {
  const raw = p.datasource?.raw;
  const type = { n: 'node', w: 'way', r: 'relation' }[String(raw?.osm_type)];
  const osmId = Math.abs(Number(raw?.osm_id));
  return type && osmId ? `${type}/${osmId}` : `geoapify/${p.place_id}`;
}

/** OSM-Tags aus `datasource.raw`; fehlende Angaben aus den aufbereiteten Geoapify-Feldern ergänzen. */
function tagsOf(p: GeoFeature['properties']): OsmTags {
  const tags: OsmTags = {};
  for (const [k, v] of Object.entries(p.datasource?.raw ?? {})) {
    if (!NOT_OSM_TAGS.has(k) && v !== null) tags[k] = String(v);
  }
  const add = (k: string, v: string | undefined) => {
    if (v && tags[k] === undefined) tags[k] = v;
  };
  const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'yes' : 'no');
  add('name', p.name);
  add('opening_hours', p.opening_hours);
  add('website', p.website);
  add('phone', p.contact?.phone);
  add('email', p.contact?.email);
  add('addr:street', p.street);
  add('addr:housenumber', p.housenumber);
  add('addr:postcode', p.postcode);
  add('addr:city', p.city);
  add('cuisine', p.catering?.cuisine);
  add('diet:vegetarian', yesNo(p.catering?.diet?.vegetarian));
  add('diet:vegan', yesNo(p.catering?.diet?.vegan));
  add('dog', yesNo(p.facilities?.dogs));
  add('wheelchair', yesNo(p.facilities?.wheelchair));
  add('outdoor_seating', yesNo(p.facilities?.outdoor_seating));
  return tags;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
