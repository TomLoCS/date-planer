import type { OsmTags, Place } from '../types';

const CUISINE_DE: Record<string, string> = {
  italian: 'Italienisch', pizza: 'Pizza', german: 'Deutsch', regional: 'Regional', greek: 'Griechisch',
  turkish: 'Türkisch', kebab: 'Döner', asian: 'Asiatisch', chinese: 'Chinesisch', japanese: 'Japanisch',
  sushi: 'Sushi', vietnamese: 'Vietnamesisch', thai: 'Thailändisch', indian: 'Indisch', korean: 'Koreanisch',
  mexican: 'Mexikanisch', spanish: 'Spanisch', french: 'Französisch', american: 'Amerikanisch',
  burger: 'Burger', steak_house: 'Steakhaus', seafood: 'Fisch & Meeresfrüchte', fish: 'Fisch',
  vegetarian: 'Vegetarisch', vegan: 'Vegan', coffee_shop: 'Kaffee', cake: 'Kuchen', ice_cream: 'Eis',
  breakfast: 'Frühstück', brunch: 'Brunch', mediterranean: 'Mediterran', oriental: 'Orientalisch',
  lebanese: 'Libanesisch', syrian: 'Syrisch', persian: 'Persisch', international: 'International',
  bagel: 'Bagels', crepe: 'Crêpes', waffle: 'Waffeln', bubble_tea: 'Bubble Tea', tapas: 'Tapas',
  austrian: 'Österreichisch', polish: 'Polnisch', portuguese: 'Portugiesisch', ethiopian: 'Äthiopisch',
};

export function cuisineText(tags: OsmTags): string | undefined {
  if (!tags.cuisine) return undefined;
  return tags.cuisine
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => CUISINE_DE[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '))
    .join(', ');
}

export function addressText(tags: OsmTags): string | undefined {
  const street = [tags['addr:street'] ?? tags['addr:place'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || undefined;
}

export function websiteOf(tags: OsmTags): string | undefined {
  const url = tags.website ?? tags['contact:website'] ?? tags.url;
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export function phoneOf(tags: OsmTags): string | undefined {
  return (tags.phone ?? tags['contact:phone'])?.split(';')[0].trim();
}

export function instagramOf(tags: OsmTags): string | undefined {
  const ig = tags['contact:instagram'];
  if (!ig) return undefined;
  return ig.startsWith('http') ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`;
}

/** Bild aus `image` (direkter Link) oder `wikimedia_commons` (File:…); `width` = Breite bei Commons-Bildern */
export function imageOf(tags: OsmTags, width = 640): string | undefined {
  const commons = tags.wikimedia_commons;
  if (commons?.startsWith('File:')) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice(5))}?width=${width}`;
  }
  const img = tags.image;
  if (img && /^https:\/\/.+\.(jpe?g|png|webp)$/i.test(img)) return img;
  return undefined;
}

const DAYS: Record<string, string> = { Mo: 'Mo', Tu: 'Di', We: 'Mi', Th: 'Do', Fr: 'Fr', Sa: 'Sa', Su: 'So', PH: 'Feiertag', off: 'geschlossen' };

/** "Mo-Fr 09:00-18:00; Sa 10:00-14:00" → ["Mo-Fr 09:00-18:00", "Sa 10:00-14:00"] mit deutschen Tagen */
export function openingHoursLines(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b/g, (d) => DAYS[d] ?? d).replace(/,(?=\S)/g, ', '));
}

export function osmUrl(place: Place): string {
  return `https://www.openstreetmap.org/${place.id}`;
}

export function osmEditUrl(place: Place): string {
  const [type, id] = place.id.split('/');
  return `https://www.openstreetmap.org/edit?${type}=${id}`;
}

export function directionsUrl(place: Place): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`;
}

export function timeText(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
