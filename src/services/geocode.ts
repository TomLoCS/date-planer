import type { LatLon } from '../types';

/** Ortssuche über Photon (komoot) – kostenlos, ohne API-Key, Fair Use. */
const PHOTON = 'https://photon.komoot.io';

export interface GeoResult extends LatLon {
  label: string;
  detail: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function toResult(f: PhotonFeature): GeoResult {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const place = [p.postcode, p.city ?? p.town ?? p.village].filter(Boolean).join(' ');
  const label = p.name ?? (street || place || 'Unbenannter Ort');
  const detail = [street !== label ? street : '', place !== label ? place : '', p.state, p.country]
    .filter(Boolean)
    .join(', ');
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label, detail };
}

export async function searchPlaces(query: string, near?: LatLon, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q: query, lang: 'de', limit: '6' });
  if (near) {
    params.set('lat', near.lat.toFixed(4));
    params.set('lon', near.lon.toFixed(4));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Ortssuche fehlgeschlagen (HTTP ${res.status})`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map(toResult);
}

/** Name zu Koordinaten, z. B. „Altona, Hamburg" für den aktuellen Standort */
export async function reverseGeocode(at: LatLon, signal?: AbortSignal): Promise<string | undefined> {
  const params = new URLSearchParams({ lat: at.lat.toFixed(5), lon: at.lon.toFixed(5), lang: 'de', limit: '1' });
  const res = await fetch(`${PHOTON}/reverse?${params}`, { signal });
  if (!res.ok) return undefined;
  const json = (await res.json()) as { features: PhotonFeature[] };
  const p = json.features[0]?.properties;
  if (!p) return undefined;
  return [p.district ?? p.locality, p.city ?? p.town ?? p.village].filter(Boolean).join(', ') || p.name;
}
