import OpeningHours from 'opening_hours';
import type { Place, Tri } from '../types';

// Geparste Öffnungszeiten pro Ort cachen – das Parsen ist der teuerste Teil beim Filtern.
const cache = new Map<string, OpeningHours | null>();

function parse(place: Place): OpeningHours | null {
  const raw = place.tags.opening_hours;
  if (!raw) return null;
  const key = `${place.id}|${raw}`;
  if (cache.has(key)) return cache.get(key)!;
  let parsed: OpeningHours | null = null;
  try {
    // Land wird für Feiertage (PH) gebraucht, Koordinaten für sunrise/sunset.
    parsed = new OpeningHours(raw, { lat: place.lat, lon: place.lon, address: { country_code: 'de', state: '' } });
  } catch {
    parsed = null;
  }
  cache.set(key, parsed);
  return parsed;
}

/** Ist der Ort zur Zeit `when` geöffnet? 'unknown' wenn keine/unlesbare Angabe. */
export function openAt(place: Place, when: Date): Tri {
  const oh = parse(place);
  if (!oh) return 'unknown';
  try {
    if (oh.getUnknown(when)) return 'unknown';
    return oh.getState(when) ? 'yes' : 'no';
  } catch {
    return 'unknown';
  }
}

/** Nächster Wechsel (öffnet/schließt) nach `when`, für Texte wie „schließt um 22:00". */
export function nextChange(place: Place, when: Date): Date | undefined {
  const oh = parse(place);
  if (!oh) return undefined;
  try {
    return oh.getNextChange(when);
  } catch {
    return undefined;
  }
}
