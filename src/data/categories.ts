import type { GroupId, OsmTags } from '../types';

/**
 * Eine Tag-Bedingung. `v` = exakter Wert, `re` = regulärer Ausdruck, keins von beiden = Schlüssel muss existieren.
 * Daraus wird sowohl die Overpass-Abfrage gebaut als auch im Browser geprüft, welcher Kategorie ein Ort angehört.
 */
export interface TagCond {
  k: string;
  v?: string;
  re?: string;
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
  group: GroupId;
  /** ODER-Liste von UND-Bedingungen */
  match: TagCond[][];
  /** Passende Geoapify-Kategorien (https://apidocs.geoapify.com/docs/places/#categories) – Feinfilter danach über `match` */
  geoapify: string[];
  /** Ohne Namen ausblenden (Standard: ja) – filtert private Pools, namenlose Grünflächen usw. */
  requireName?: boolean;
  /** Anzeigename, wenn der Ort keinen Namen hat */
  fallbackName?: string;
  /** Speise-Kriterien (vegetarisch/vegan) gelten hier */
  food?: boolean;
  /** Findet von Natur aus draußen statt */
  outdoor?: boolean;
  /** Hat mit Wasser zu tun (Strand, Boot, Schwimmbad …) */
  water?: boolean;
  /** Eintritt: immer gratis, nie gratis, oder je nach `fee`-Tag */
  free?: 'always' | 'never' | 'maybe';
  /** Ohne Öffnungszeiten trotzdem als offen werten (Park, Aussichtspunkt) */
  alwaysOpen?: boolean;
}

export interface Group {
  id: GroupId;
  label: string;
  emoji: string;
  color: string;
}

export const GROUPS: Group[] = [
  { id: 'food', label: 'Essen & Trinken', emoji: '🍽️', color: '#ea580c' },
  { id: 'nature', label: 'Natur & Draußen', emoji: '🌳', color: '#16a34a' },
  { id: 'culture', label: 'Kultur', emoji: '🎭', color: '#7c3aed' },
  { id: 'active', label: 'Aktiv', emoji: '🎳', color: '#2563eb' },
  { id: 'wellness', label: 'Wellness', emoji: '🧖', color: '#db2777' },
];

const t = (k: string, v: string): TagCond => ({ k, v });
const re = (k: string, pattern: string): TagCond => ({ k, re: pattern });

export const CATEGORIES: Category[] = [
  // Essen & Trinken
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️', group: 'food', match: [[t('amenity', 'restaurant')]], geoapify: ['catering.restaurant'], food: true, free: 'never' },
  { id: 'cafe', label: 'Café', emoji: '☕', group: 'food', match: [[t('amenity', 'cafe')]], geoapify: ['catering.cafe'], food: true, free: 'never' },
  { id: 'bar', label: 'Bar & Kneipe', emoji: '🍸', group: 'food', match: [[re('amenity', '^(bar|pub|biergarten)$')]], geoapify: ['catering.bar', 'catering.pub', 'catering.biergarten'], food: true, free: 'never' },
  { id: 'ice_cream', label: 'Eisdiele', emoji: '🍦', group: 'food', match: [[t('amenity', 'ice_cream')]], geoapify: ['catering.ice_cream'], food: true, free: 'never' },

  // Natur & Draußen
  { id: 'park', label: 'Park', emoji: '🌳', group: 'nature', match: [[t('leisure', 'park')]], geoapify: ['leisure.park'], outdoor: true, free: 'always', alwaysOpen: true },
  { id: 'viewpoint', label: 'Aussichtspunkt', emoji: '🌄', group: 'nature', match: [[t('tourism', 'viewpoint')]], geoapify: ['tourism.attraction.viewpoint'], requireName: false, fallbackName: 'Aussichtspunkt', outdoor: true, free: 'always', alwaysOpen: true },
  {
    id: 'beach', label: 'Strand & Badestelle', emoji: '🏖️', group: 'nature',
    match: [[t('natural', 'beach')], [re('leisure', '^(bathing_place|swimming_area|beach_resort)$')]],
    geoapify: ['beach'],
    requireName: false, fallbackName: 'Badestelle', outdoor: true, water: true, free: 'always', alwaysOpen: true,
  },
  { id: 'picnic', label: 'Picknickplatz', emoji: '🧺', group: 'nature', match: [[t('tourism', 'picnic_site')]], geoapify: ['leisure.picnic.picnic_site'], requireName: false, fallbackName: 'Picknickplatz', outdoor: true, free: 'always', alwaysOpen: true },
  { id: 'garden', label: 'Garten', emoji: '🌷', group: 'nature', match: [[t('leisure', 'garden')]], geoapify: ['leisure.park.garden'], outdoor: true, free: 'maybe' },

  // Kultur
  { id: 'museum', label: 'Museum', emoji: '🏛️', group: 'culture', match: [[t('tourism', 'museum')]], geoapify: ['entertainment.museum'], free: 'maybe' },
  { id: 'cinema', label: 'Kino', emoji: '🎬', group: 'culture', match: [[t('amenity', 'cinema')]], geoapify: ['entertainment.cinema'], free: 'never' },
  { id: 'theatre', label: 'Theater', emoji: '🎭', group: 'culture', match: [[t('amenity', 'theatre')]], geoapify: ['entertainment.culture.theatre'], free: 'maybe' },
  { id: 'gallery', label: 'Galerie', emoji: '🖼️', group: 'culture', match: [[t('tourism', 'gallery')]], geoapify: ['entertainment.culture.gallery'], free: 'maybe' },
  { id: 'zoo', label: 'Zoo & Aquarium', emoji: '🦒', group: 'culture', match: [[re('tourism', '^(zoo|aquarium)$')]], geoapify: ['entertainment.zoo', 'entertainment.aquarium'], free: 'maybe' },

  // Aktiv
  { id: 'bowling', label: 'Bowling', emoji: '🎳', group: 'active', match: [[t('leisure', 'bowling_alley')]], geoapify: ['entertainment.bowling_alley'], free: 'never' },
  { id: 'minigolf', label: 'Minigolf', emoji: '⛳', group: 'active', match: [[t('leisure', 'miniature_golf')]], geoapify: ['entertainment.miniature_golf'], outdoor: true, free: 'maybe' },
  {
    id: 'climbing', label: 'Klettern & Bouldern', emoji: '🧗', group: 'active',
    match: [[re('leisure', '^(sports_centre|sports_hall|fitness_centre)$'), re('sport', 'climbing|bouldering')]],
    geoapify: ['entertainment.activity_park.climbing', 'sport.sports_centre'], free: 'never',
  },
  { id: 'escape', label: 'Escape Room', emoji: '🔐', group: 'active', match: [[t('leisure', 'escape_game')]], geoapify: ['entertainment.escape_game'], free: 'never' },
  {
    id: 'swimming', label: 'Schwimmbad', emoji: '🏊', group: 'active',
    match: [[t('leisure', 'water_park')], [t('leisure', 'sports_centre'), re('sport', 'swimming')], [t('leisure', 'swimming_pool'), re('access', '^(yes|public|customers)$')]],
    geoapify: ['entertainment.water_park', 'sport.swimming_pool', 'sport.sports_centre'],
    water: true, free: 'maybe',
  },
  { id: 'boat', label: 'Bootsverleih', emoji: '⛵', group: 'active', match: [[t('amenity', 'boat_rental')]], geoapify: ['rental.boat'], requireName: false, fallbackName: 'Bootsverleih', outdoor: true, water: true, free: 'never' },
  { id: 'trampoline', label: 'Trampolinpark', emoji: '🤸', group: 'active', match: [[t('leisure', 'trampoline_park')]], geoapify: ['entertainment.activity_park.trampoline'], free: 'never' },

  // Wellness
  { id: 'sauna', label: 'Sauna & Therme', emoji: '🧖', group: 'wellness', match: [[t('leisure', 'sauna')], [t('amenity', 'public_bath')]], geoapify: ['leisure.spa.sauna', 'leisure.spa.public_bath'], free: 'never' },
];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, Group>;

export const DEFAULT_CATEGORIES = ['restaurant', 'cafe', 'park', 'viewpoint'];

export function categoryOf(id: string): Category {
  return CATEGORY_BY_ID[id] ?? CATEGORIES[0];
}

export function colorOf(categoryId: string): string {
  return GROUP_BY_ID[categoryOf(categoryId).group].color;
}

function condMatches(c: TagCond, tags: OsmTags): boolean {
  const value = tags[c.k];
  if (value === undefined) return false;
  if (c.v !== undefined) return value === c.v;
  if (c.re !== undefined) return new RegExp(c.re).test(value);
  return true;
}

/** Erste ausgewählte Kategorie, auf deren Bedingungen die Tags passen. */
export function matchCategory(tags: OsmTags, candidates: Category[]): Category | undefined {
  return candidates.find((cat) => cat.match.some((conds) => conds.every((c) => condMatches(c, tags))));
}

/** Overpass-QL-Filter, z. B. `["amenity"="cafe"]` */
export function condsToOverpass(conds: TagCond[]): string {
  return conds
    .map((c) => {
      if (c.v !== undefined) return `["${c.k}"="${c.v}"]`;
      if (c.re !== undefined) return `["${c.k}"~"${c.re}"]`;
      return `["${c.k}"]`;
    })
    .join('');
}
