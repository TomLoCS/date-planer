import { useState } from 'react';
import type { Place } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { imageOf } from '../lib/format';

/** Vorschaubild: Foto aus OSM/Wikimedia, sonst das Kategorie-Emoji auf einer zarten Fläche in Gruppenfarbe */
export function PlaceThumb({ place }: { place: Place }) {
  const [failed, setFailed] = useState(false);
  const image = imageOf(place.tags, 160);
  const color = colorOf(place.categoryId);
  return (
    <span className="place-media thumb" style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))` }} aria-hidden>
      <span className="thumb-emoji">{categoryOf(place.categoryId).emoji}</span>
      {image && !failed && <img src={image} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </span>
  );
}
