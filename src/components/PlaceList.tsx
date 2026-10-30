import type { Place, Tri } from '../types';
import type { Evaluation } from '../data/criteria';
import { categoryOf, colorOf } from '../data/categories';
import { formatDistance } from '../lib/geo';
import { CriteriaBadges } from './CriteriaBadges';
import { PlaceThumb } from './PlaceThumb';

export interface ListItem {
  place: Place;
  ev: Evaluation;
  dist: number;
  open: Tri;
}

interface Props {
  items: ListItem[];
  selectedId?: string;
  onSelect: (place: Place) => void;
}

const PAGE = 60;

/** Anteil der bestätigten Kriterien (nur die, die für die Kategorie zählen), z. B. 3 von 4 → 75 % */
function matchPercent(ev: Evaluation): number | undefined {
  const relevant = Object.values(ev.results).filter((r) => r !== 'na');
  if (!relevant.length) return undefined;
  return Math.round((relevant.filter((r) => r === 'yes').length / relevant.length) * 100);
}

export function PlaceList({ items, selectedId, onSelect }: Props) {
  if (!items.length) return null;
  return (
    <ul className="place-list stack">
      {items.slice(0, PAGE).map(({ place, ev, dist, open }) => {
        const cat = categoryOf(place.categoryId);
        const match = matchPercent(ev);
        const showBadges = ev.level === 'partial';
        return (
          <li key={place.id}>
            <button className={`place-card row-card level-${ev.level} ${place.id === selectedId ? 'selected' : ''}`} onClick={() => onSelect(place)}>
              <PlaceThumb place={place} />
              <span className="place-body">
                <span className="place-title">{place.name}</span>
                <span className="place-meta">
                  <span style={{ color: colorOf(place.categoryId) }}>{cat.label}</span>
                  <span>{formatDistance(dist)}</span>
                  {open === 'yes' && <span className="open-yes">geöffnet</span>}
                  {open === 'no' && <span className="open-no">geschlossen</span>}
                </span>
                {showBadges && <CriteriaBadges results={ev.results} compact />}
              </span>
              {match !== undefined && <span className="match">{match} %</span>}
            </button>
          </li>
        );
      })}
      {items.length > PAGE && <li className="footnote list-more">+ {items.length - PAGE} weitere auf der Karte</li>}
    </ul>
  );
}
