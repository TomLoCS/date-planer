import type { CriterionId, Place, Tri } from '../types';
import { categoryOf } from './categories';
import { openAt } from '../lib/openingHours';

export interface CriterionContext {
  /** Zeitpunkt, für den „geöffnet" geprüft wird */
  when: Date;
  /** Wurde die Nähe zu Wasser per Overpass mit abgefragt? */
  waterChecked: boolean;
}

export interface Criterion {
  id: CriterionId;
  label: string;
  emoji: string;
  hint: string;
  evaluate: (place: Place, ctx: CriterionContext) => Tri;
}

const YES_DOG = /^(yes|leashed|outside|unleashed|designated)$/;
const YES_DIET = /^(yes|only)$/;

function diet(place: Place, key: 'vegetarian' | 'vegan'): Tri {
  if (!categoryOf(place.categoryId).food) return 'na';
  const veg = place.tags['diet:vegetarian'];
  const vegan = place.tags['diet:vegan'];
  if (key === 'vegan') {
    if (vegan && YES_DIET.test(vegan)) return 'yes';
    if (vegan === 'no') return 'no';
    return 'unknown';
  }
  if ((veg && YES_DIET.test(veg)) || (vegan && YES_DIET.test(vegan))) return 'yes';
  if (veg === 'no') return 'no';
  return 'unknown';
}

export const CRITERIA: Criterion[] = [
  {
    id: 'dog',
    label: 'Hund erlaubt',
    emoji: '🐕',
    hint: 'OSM-Tag dog=yes/leashed. Oft nicht eingetragen.',
    evaluate: (p) => {
      const dog = p.tags.dog;
      if (!dog) return 'unknown';
      if (YES_DOG.test(dog)) return 'yes';
      if (dog === 'no') return 'no';
      return 'unknown';
    },
  },
  {
    id: 'vegetarian',
    label: 'Vegetarisch',
    emoji: '🥗',
    hint: 'Nur bei Essen & Trinken: diet:vegetarian=yes/only (vegan zählt mit).',
    evaluate: (p) => diet(p, 'vegetarian'),
  },
  {
    id: 'vegan',
    label: 'Vegan',
    emoji: '🌱',
    hint: 'Nur bei Essen & Trinken: diet:vegan=yes/only.',
    evaluate: (p) => diet(p, 'vegan'),
  },
  {
    id: 'water',
    label: 'Am Wasser',
    emoji: '🌊',
    hint: 'Wasser-Aktivität (Strand, Boot, Bad) oder höchstens 120 m von See, Fluss, Kanal oder Küste.',
    evaluate: (p, ctx) => {
      if (categoryOf(p.categoryId).water || p.nearWater) return 'yes';
      return ctx.waterChecked ? 'no' : 'unknown';
    },
  },
  {
    id: 'wheelchair',
    label: 'Barrierefrei',
    emoji: '♿',
    hint: 'wheelchair=yes. „limited" zählt als unbekannt.',
    evaluate: (p) => {
      const w = p.tags.wheelchair;
      if (w === 'yes' || w === 'designated') return 'yes';
      if (w === 'no') return 'no';
      return 'unknown';
    },
  },
  {
    id: 'outdoor',
    label: 'Draußen',
    emoji: '☀️',
    hint: 'Draußen-Aktivität oder Außenbereich (outdoor_seating=yes).',
    evaluate: (p) => {
      if (categoryOf(p.categoryId).outdoor) return 'yes';
      const o = p.tags.outdoor_seating;
      if (o === 'yes') return 'yes';
      if (o === 'no') return 'no';
      return 'unknown';
    },
  },
  {
    id: 'free',
    label: 'Kostenlos',
    emoji: '💸',
    hint: 'Kein Eintritt (fee=no) oder von Natur aus gratis (Park, Aussicht …).',
    evaluate: (p) => {
      const fee = p.tags.fee;
      if (fee === 'no') return 'yes';
      if (fee && fee !== 'no') return 'no';
      const free = categoryOf(p.categoryId).free;
      if (free === 'always') return 'yes';
      if (free === 'never') return 'no';
      return 'unknown';
    },
  },
  {
    id: 'open',
    label: 'Geöffnet',
    emoji: '🕐',
    hint: 'Laut Öffnungszeiten zur gewählten Zeit offen. Parks & Co. ohne Angabe gelten als offen.',
    evaluate: (p, ctx) => {
      if (!p.tags.opening_hours) return categoryOf(p.categoryId).alwaysOpen ? 'yes' : 'unknown';
      return openAt(p, ctx.when);
    },
  },
];

export const CRITERION_BY_ID = Object.fromEntries(CRITERIA.map((c) => [c.id, c])) as Record<CriterionId, Criterion>;

export type MatchLevel = 'match' | 'partial' | 'fail';

export interface Evaluation {
  level: MatchLevel;
  /** Anzahl bestätigter aktiver Kriterien */
  score: number;
  results: Partial<Record<CriterionId, Tri>>;
}

/**
 * Prüft einen Ort gegen die aktiven Kriterien.
 * - irgendein „nein" → fail (wird nie angezeigt)
 * - irgendein „unbekannt" → partial (nur mit „Ohne Angabe einblenden")
 * - sonst → match
 */
export function evaluatePlace(place: Place, active: CriterionId[], ctx: CriterionContext): Evaluation {
  const results: Partial<Record<CriterionId, Tri>> = {};
  let level: MatchLevel = 'match';
  let score = 0;
  for (const id of active) {
    const r = CRITERION_BY_ID[id].evaluate(place, ctx);
    results[id] = r;
    if (r === 'no') level = 'fail';
    else if (r === 'unknown' && level === 'match') level = 'partial';
    else if (r === 'yes') score++;
  }
  return { level, score, results };
}
