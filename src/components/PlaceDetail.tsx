import { useState, type ReactNode } from 'react';
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
import { Icon } from './Icon';

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
      <button className="btn-icon sm detail-close" onClick={onClose} aria-label="Schließen">
        <Icon name="close" size={16} />
      </button>
      {image && !imgFailed && (
        <div className="place-media detail-media">
          <img src={image} alt="" loading="lazy" onError={() => setImgFailed(true)} />
          {dist !== undefined && <span className="badge">{formatDistance(dist)}</span>}
        </div>
      )}

      <div className="detail-body stack">
        <header className="detail-head">
          <span className="eyebrow" style={{ color: colorOf(place.categoryId) }}>
            {cat.emoji} {cat.label} · {GROUP_BY_ID[cat.group].label}
          </span>
          <h2 className="title-2">{place.name}</h2>
          <p className="place-meta">
            {dist !== undefined && <span>{formatDistance(dist)} entfernt</span>}
            {open === 'yes' && <span className="open-yes">Geöffnet{change && sameDay ? ` · schließt ${timeText(change)}` : ''}</span>}
            {open === 'no' && <span className="open-no">Geschlossen{change && sameDay ? ` · öffnet ${timeText(change)}` : ''}</span>}
          </p>
        </header>

        <div className="detail-actions row">
          <button className="btn btn-primary" onClick={onAddToPlan} disabled={inPlan}>
            <Icon name={inPlan ? 'check' : 'plus'} /> {inPlan ? 'Im Plan' : 'Zum Plan'}
          </button>
          <button className="btn btn-tinted" onClick={onToggleFavorite} aria-pressed={isFavorite}>
            <Icon name={isFavorite ? 'heartFill' : 'heart'} /> {isFavorite ? 'Gemerkt' : 'Merken'}
          </button>
          <a className="btn-icon" href={directionsUrl(place)} target="_blank" rel="noreferrer" title="Route in Google Maps" aria-label="Route in Google Maps">
            <Icon name="route" />
          </a>
        </div>

        {hasTags ? (
          <>
            <section className="stack detail-section">
              <h3 className="headline">Passt das?</h3>
              <CriteriaBadges results={results} />
              {(results.dog === 'unknown' || results.vegetarian === 'unknown') && (
                <p className="footnote">„?" heißt: in OpenStreetMap nicht eingetragen. Im Zweifel kurz anrufen.</p>
              )}
            </section>

            {(address || cuisine || hours.length > 0 || phone || website || instagram || tags.description) && (
              <dl className="list detail-facts">
                {address && <Fact label="Adresse">{address}</Fact>}
                {cuisine && <Fact label="Küche">{cuisine}</Fact>}
                {hours.length > 0 && (
                  <Fact label="Öffnungszeiten">
                    {hours.map((h) => (
                      <div key={h}>{h}</div>
                    ))}
                  </Fact>
                )}
                {phone && (
                  <Fact label="Telefon">
                    <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
                  </Fact>
                )}
                {website && (
                  <Fact label="Website">
                    <a href={website} target="_blank" rel="noreferrer">
                      {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </a>
                  </Fact>
                )}
                {instagram && (
                  <Fact label="Instagram">
                    <a href={instagram} target="_blank" rel="noreferrer">
                      {instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
                    </a>
                  </Fact>
                )}
                {tags.description && <Fact label="Info">{tags.description}</Fact>}
              </dl>
            )}
          </>
        ) : (
          <p className="footnote">Aus einem geteilten Plan – Details erscheinen, sobald der Ort in einer Suche auftaucht.</p>
        )}

        <footer className="detail-foot">
          <a className="footnote" href={osmUrl(place)} target="_blank" rel="noreferrer">
            Auf OpenStreetMap ansehen
          </a>
          <a className="footnote" href={osmEditUrl(place)} target="_blank" rel="noreferrer">
            Daten fehlen? In OSM ergänzen
          </a>
        </footer>
      </div>
    </article>
  );
}

/** Eine Zeile der Info-Liste: Bezeichnung klein darüber, Wert darunter */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt className="footnote">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
