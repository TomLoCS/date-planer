import type { Place } from '../types';
import type { Evaluation } from '../data/criteria';
import { categoryOf, colorOf } from '../data/categories';
import { formatDistance } from '../lib/geo';
import { CriteriaBadges } from './CriteriaBadges';

export interface ListItem {
  place: Place;
  ev: Evaluation;
  dist: number;
  open: 'yes' | 'no' | 'unknown' | 'na';
}

interface Props {
  items: ListItem[];
  selectedId?: string;
  onSelect: (place: Place) => void;
}

const PAGE = 60;

export function PlaceList({ items, selectedId, onSelect }: Props) {
  if (!items.length) return null;
  return (
    <ul className="place-list">
      {items.slice(0, PAGE).map(({ place, ev, dist, open }) => {
        const cat = categoryOf(place.categoryId);
        return (
          <li key={place.id}>
            <button className={`place-item ${place.id === selectedId ? 'selected' : ''} ${ev.level}`} onClick={() => onSelect(place)}>
              <span className="place-emoji" style={{ background: colorOf(place.categoryId) }} aria-hidden>
                {cat.emoji}
              </span>
              <span className="place-main">
                <span className="place-name">{place.name}</span>
                <span className="place-meta">
                  {cat.label} · {formatDistance(dist)}
                  {open === 'yes' && <span className="open-yes"> · geöffnet</span>}
                  {open === 'no' && <span className="open-no"> · geschlossen</span>}
                </span>
                <CriteriaBadges results={ev.results} compact />
              </span>
            </button>
          </li>
        );
      })}
      {items.length > PAGE && <li className="list-more">+ {items.length - PAGE} weitere auf der Karte</li>}
    </ul>
  );
}
