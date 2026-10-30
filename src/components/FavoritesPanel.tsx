import type { Place } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { addressText } from '../lib/format';
import { Icon } from './Icon';
import { PlaceThumb } from './PlaceThumb';

interface Props {
  favorites: Place[];
  onSelect: (place: Place) => void;
  onRemove: (place: Place) => void;
  onAddToPlan: (place: Place) => void;
}

export function FavoritesPanel({ favorites, onSelect, onRemove, onAddToPlan }: Props) {
  if (!favorites.length) {
    return (
      <div className="empty stack">
        <p className="headline">Noch nichts gemerkt</p>
        <p className="subhead">Tippe bei einem Ort auf „Merken", um ihn hier zu sammeln.</p>
      </div>
    );
  }
  return (
    <ul className="place-list stack">
      {favorites.map((place) => {
        const cat = categoryOf(place.categoryId);
        const address = addressText(place.tags);
        return (
          <li key={place.id} className="place-card row-card fav-card">
            <button className="fav-main" onClick={() => onSelect(place)}>
              <PlaceThumb place={place} />
              <span className="place-body">
                <span className="place-title">{place.name}</span>
                <span className="place-meta">
                  <span style={{ color: colorOf(place.categoryId) }}>{cat.label}</span>
                  {address && <span>{address}</span>}
                </span>
              </span>
            </button>
            <button className="btn-icon sm" onClick={() => onAddToPlan(place)} title="Zum Plan" aria-label="Zum Plan">
              <Icon name="plus" size={16} />
            </button>
            <button className="btn-icon sm fav-remove" onClick={() => onRemove(place)} title="Nicht mehr merken" aria-label="Nicht mehr merken">
              <Icon name="heartFill" size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
