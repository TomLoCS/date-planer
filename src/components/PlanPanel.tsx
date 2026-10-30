import type { Place, Plan, PlanStop, SavedPlan } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { formatDistance } from '../lib/geo';
import { planDistance, planRouteUrl } from '../lib/share';
import { Icon } from './Icon';

interface Props {
  plan: Plan;
  savedPlans: SavedPlan[];
  onChange: (plan: Plan) => void;
  onSelect: (place: Place) => void;
  onShare: () => void;
  onCalendar: () => void;
  onSave: () => void;
  onLoad: (p: SavedPlan) => void;
  onDeleteSaved: (id: string) => void;
  onDiscover: () => void;
}

export function PlanPanel({ plan, savedPlans, onChange, onSelect, onShare, onCalendar, onSave, onLoad, onDeleteSaved, onDiscover }: Props) {
  const stops = plan.stops;
  const setStops = (s: PlanStop[]) => onChange({ ...plan, stops: s });
  const update = (uid: string, patch: Partial<PlanStop>) => setStops(stops.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stops];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setStops(next);
  };

  return (
    <div className="plan stack-lg">
      <ul className="list">
        <li className="list-row">
          <input
            className="plan-title"
            value={plan.title}
            placeholder="Name für euer Date …"
            onChange={(e) => onChange({ ...plan, title: e.target.value })}
            aria-label="Titel des Plans"
          />
        </li>
        <li className="list-row">
          <span>Datum</span>
          <input className="plan-date" type="date" value={plan.date} onChange={(e) => onChange({ ...plan, date: e.target.value })} aria-label="Datum" />
        </li>
      </ul>

      {stops.length === 0 ? (
        <div className="empty stack">
          <p className="headline">Noch keine Stopps</p>
          <p className="subhead">Wähle Orte auf der Karte und tippe „Zum Plan" – oder lass dich mit dem Würfel überraschen.</p>
          <button className="btn btn-primary" onClick={onDiscover}>
            Orte entdecken
          </button>
        </div>
      ) : (
        <section className="stack">
          <div className="row section-head">
            <h2 className="headline">Ablauf</h2>
            <span className="footnote">
              {stops.length} {stops.length === 1 ? 'Stopp' : 'Stopps'}
              {stops.length > 1 && ` · ${formatDistance(planDistance(stops))} Luftlinie`}
            </span>
          </div>
          <ol className="list stops">
            {stops.map((s, i) => {
              const cat = categoryOf(s.place.categoryId);
              return (
                <li key={s.uid} className="stop">
                  <span className="stop-num" style={{ background: colorOf(s.place.categoryId) }}>
                    {i + 1}
                  </span>
                  <div className="stop-body">
                    <div className="row">
                      <input className="stop-time" type="time" value={s.time} onChange={(e) => update(s.uid, { time: e.target.value })} aria-label="Uhrzeit" />
                      <button className="stop-name" onClick={() => onSelect(s.place)}>
                        {cat.emoji} {s.place.name}
                      </button>
                    </div>
                    <input
                      className="stop-note"
                      value={s.note}
                      placeholder="Notiz, z. B. Tisch reserviert"
                      onChange={(e) => update(s.uid, { note: e.target.value })}
                      aria-label="Notiz"
                    />
                    <div className="row stop-tools">
                      <button className="btn-icon sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Nach oben">
                        <Icon name="up" size={16} />
                      </button>
                      <button className="btn-icon sm" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Nach unten">
                        <Icon name="down" size={16} />
                      </button>
                      <button className="btn-icon sm" onClick={() => setStops(stops.filter((x) => x.uid !== s.uid))} aria-label="Entfernen">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <a className="btn btn-primary btn-lg" href={planRouteUrl(stops)} target="_blank" rel="noreferrer">
            <Icon name="route" /> Route starten
          </a>
          <div className="row wrap plan-actions">
            <button className="btn btn-secondary btn-sm" onClick={onShare}>
              <Icon name="share" /> Teilen
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onCalendar}>
              <Icon name="calendar" /> Kalender
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onSave}>
              <Icon name="save" /> Speichern
            </button>
            <button className="btn btn-plain btn-sm" onClick={() => onChange({ title: '', date: plan.date, stops: [] })}>
              Leeren
            </button>
          </div>
        </section>
      )}

      {savedPlans.length > 0 && (
        <section className="stack">
          <h2 className="headline">Gespeicherte Pläne</h2>
          <ul className="list">
            {savedPlans.map((p) => (
              <li key={p.id} className="saved-row">
                <button className="list-row" onClick={() => onLoad(p)}>
                  <span className="list-label">
                    {p.title || 'Ohne Titel'}
                    <span className="footnote">
                      {p.date ? new Date(p.date).toLocaleDateString('de-DE') + ' · ' : ''}
                      {p.stops.length} Stopps
                    </span>
                  </span>
                  <span className="value chevron" />
                </button>
                <button className="btn-icon sm saved-delete" onClick={() => onDeleteSaved(p.id)} aria-label="Gespeicherten Plan löschen">
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
