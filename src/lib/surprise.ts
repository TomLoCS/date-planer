import type { Place } from '../types';
import { categoryOf } from '../data/categories';
import { distance } from './geo';

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Zufällig einer der `n` nächstgelegenen Orte zu `from` im Umkreis von `maxM` Metern */
function nearbyPick(pool: Place[], from: Place, maxM = 1500, n = 4): Place | undefined {
  const near = pool
    .map((p) => ({ p, d: distance(from, p) }))
    .filter((x) => x.d <= maxM)
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
  return near.length ? pick(near).p : undefined;
}

/**
 * Würfelt einen Date-Ablauf aus den aktuell passenden Orten:
 * Aktivität → Essen in der Nähe → Drinks in der Nähe (soweit vorhanden).
 */
export function surpriseDate(places: Place[]): Place[] {
  if (places.length === 0) return [];
  const isFood = (p: Place) => categoryOf(p.categoryId).group === 'food';
  const isBar = (p: Place) => p.categoryId === 'bar';

  const activities = places.filter((p) => !isFood(p));
  const meals = places.filter((p) => isFood(p) && !isBar(p));
  const bars = places.filter(isBar);

  const first = pick(activities.length ? activities : meals.length ? meals : bars);
  const stops = [first];
  const last = () => stops[stops.length - 1];

  if (!isFood(first)) {
    const meal = nearbyPick(meals, first);
    if (meal) stops.push(meal);
  }
  if (!isBar(last())) {
    const bar = nearbyPick(bars, last());
    if (bar) stops.push(bar);
  }
  if (stops.length === 1 && activities.length > 1) {
    const other = nearbyPick(activities.filter((p) => p.id !== first.id && p.categoryId !== first.categoryId), first, 2000);
    if (other) stops.push(other);
  }
  return stops;
}

/** Uhrzeiten für einen Abend: 2 Stopps → 17:30/19:30, 3 Stopps → 16:30/18:30/20:30 */
export function surpriseTimes(count: number): string[] {
  const start = count >= 3 ? 16.5 : count === 2 ? 17.5 : 18;
  return Array.from({ length: count }, (_, i) => {
    const h = start + i * 2;
    return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
  });
}
