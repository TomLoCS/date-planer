import type { Place } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { addressText } from '../lib/format';

interface Props {
  favorites: Place[];
  onSelect: (place: Place) => void;
  onRemove: (place: Place) => void;
  onAddToPlan: (place: Place) => void;
}

export function FavoritesPanel({ favorites, onSelect, onRemove, onAddToPlan }: Props) {
  if (!favorites.length) {
    return (
      <div className="empty">
        <p>Noch nichts gemerkt.</p>
        <p className="hint">Tippe bei einem Ort auf „♡ Merken", um ihn hier zu sammeln.</p>
      </div>
    );
  }
  return (
    <ul className="place-list">
      {favorites.map((place) => {
        const cat = categoryOf(place.categoryId);
        return (
          <li key={place.id} className="fav-item">
            <button className="place-item" onClick={() => onSelect(place)}>
              <span className="place-emoji" style={{ background: colorOf(place.categoryId) }} aria-hidden>
                {cat.emoji}
              </span>
              <span className="place-main">
                <span className="place-name">{place.name}</span>
                <span className="place-meta">{addressText(place.tags) ?? cat.label}</span>
              </span>
            </button>
            <button className="icon-btn sm" onClick={() => onAddToPlan(place)} title="Zum Plan">
              ＋
            </button>
            <button className="icon-btn sm" onClick={() => onRemove(place)} title="Entfernen">
              ♥
            </button>
          </li>
        );
      })}
    </ul>
  );
}
