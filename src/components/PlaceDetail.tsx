import { useState } from 'react';
import type { CriterionId, Place, Tri } from '../types';
import { categoryOf, colorOf, GROUP_BY_ID } from '../data/categories';
import { CRITERIA, type CriterionContext } from '../data/criteria';
import { formatDistance } from '../lib/geo';
import { nextChange } from '../lib/openingHours';
import {
  addressText, cuisineText, directionsUrl, imageOf, instagramOf, openingHoursLines,
  osmEditUrl, osmUrl, phoneOf, timeText, websiteOf,
} from '../lib/format';
import { CriteriaBadges } from './CriteriaBadges';

interface Props {
  place: Place;
  ctx: CriterionContext;
  dist?: number;
  isFavorite: boolean;
  inPlan: boolean;
  onAddToPlan: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export function PlaceDetail({ place, ctx, dist, isFavorite, inPlan, onAddToPlan, onToggleFavorite, onClose }: Props) {
  const cat = categoryOf(place.categoryId);
  const tags = place.tags;
  const hasTags = Object.keys(tags).length > 0;
  const [imgFailed, setImgFailed] = useState(false);

  const results = Object.fromEntries(CRITERIA.map((c) => [c.id, c.evaluate(place, ctx)])) as Record<CriterionId, Tri>;
  const open = results.open;
  const change = tags.opening_hours ? nextChange(place, ctx.when) : undefined;
  const sameDay = change && change.toDateString() === ctx.when.toDateString();

  const address = addressText(tags);
  const website = websiteOf(tags);
  const phone = phoneOf(tags);
  const instagram = instagramOf(tags);
  const cuisine = cuisineText(tags);
  const image = imageOf(tags);
  const hours = openingHoursLines(tags.opening_hours);

  return (
    <article className="detail" aria-label={place.name}>
      <button className="detail-close icon-btn" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      {image && !imgFailed && <img className="detail-img" src={image} alt="" loading="lazy" onError={() => setImgFailed(true)} />}

      <header className="detail-head">
        <span className="detail-cat" style={{ color: colorOf(place.categoryId) }}>
          {cat.emoji} {cat.label} · {GROUP_BY_ID[cat.group].label}
        </span>
        <h2>{place.name}</h2>
        <div className="detail-sub">
          {dist !== undefined && <span>{formatDistance(dist)} entfernt</span>}
          {open === 'yes' && (
            <span className="open-yes">
              ● Geöffnet{change && sameDay ? ` · schließt ${timeText(change)}` : ''}
            </span>
          )}
          {open === 'no' && (
            <span className="open-no">
              ● Geschlossen{change && sameDay ? ` · öffnet ${timeText(change)}` : ''}
            </span>
          )}
        </div>
      </header>

      <div className="detail-actions">
        <button className="btn primary" onClick={onAddToPlan} disabled={inPlan}>
          {inPlan ? '✓ Im Plan' : '＋ Zum Plan'}
        </button>
        <button className={`btn ${isFavorite ? 'fav-on' : ''}`} onClick={onToggleFavorite} aria-pressed={isFavorite}>
          {isFavorite ? '♥ Gemerkt' : '♡ Merken'}
        </button>
        <a className="btn" href={directionsUrl(place)} target="_blank" rel="noreferrer">
          🧭 Route
        </a>
      </div>

      {hasTags ? (
        <>
          <section className="detail-section">
            <h3>Passt das?</h3>
            <CriteriaBadges results={results} />
            {(results.dog === 'unknown' || results.vegetarian === 'unknown') && (
              <p className="hint">„?" heißt: in OpenStreetMap nicht eingetragen. Im Zweifel kurz anrufen.</p>
            )}
          </section>

          <dl className="detail-facts">
            {address && (
              <>
                <dt>Adresse</dt>
                <dd>{address}</dd>
              </>
            )}
            {cuisine && (
              <>
                <dt>Küche</dt>
                <dd>{cuisine}</dd>
              </>
            )}
            {hours.length > 0 && (
              <>
                <dt>Öffnungszeiten</dt>
                <dd>
                  {hours.map((h) => (
                    <div key={h}>{h}</div>
                  ))}
                </dd>
              </>
            )}
            {phone && (
              <>
                <dt>Telefon</dt>
                <dd>
                  <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
                </dd>
              </>
            )}
            {website && (
              <>
                <dt>Website</dt>
                <dd>
                  <a href={website} target="_blank" rel="noreferrer">
                    {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </dd>
              </>
            )}
            {instagram && (
              <>
                <dt>Instagram</dt>
                <dd>
                  <a href={instagram} target="_blank" rel="noreferrer">
                    {instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
                  </a>
                </dd>
              </>
            )}
            {tags.description && (
              <>
                <dt>Info</dt>
                <dd>{tags.description}</dd>
              </>
            )}
          </dl>
        </>
      ) : (
        <p className="hint">Aus einem geteilten Plan – Details erscheinen, sobald der Ort in einer Suche auftaucht.</p>
      )}

      <footer className="detail-foot">
        <a href={osmUrl(place)} target="_blank" rel="noreferrer">
          Auf OpenStreetMap ansehen
        </a>
        <a href={osmEditUrl(place)} target="_blank" rel="noreferrer">
          ✏️ Daten fehlen? In OSM ergänzen
        </a>
      </footer>
    </article>
  );
}
