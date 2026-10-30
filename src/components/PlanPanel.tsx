import type { Place, Plan, PlanStop, SavedPlan } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { formatDistance } from '../lib/geo';
import { planDistance, planRouteUrl } from '../lib/share';

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
    <div className="plan">
      <div className="plan-head">
        <input
          className="plan-title"
          value={plan.title}
          placeholder="Name für euer Date …"
          onChange={(e) => onChange({ ...plan, title: e.target.value })}
          aria-label="Titel des Plans"
        />
        <input type="date" value={plan.date} onChange={(e) => onChange({ ...plan, date: e.target.value })} aria-label="Datum" />
      </div>

      {stops.length === 0 ? (
        <div className="empty">
          <p>Noch keine Stopps.</p>
          <p className="hint">Wähle Orte auf der Karte und tippe „＋ Zum Plan" – oder lass dich mit 🎲 überraschen.</p>
          <button className="btn primary" onClick={onDiscover}>
            Orte entdecken
          </button>
        </div>
      ) : (
        <>
          <ol className="stops">
            {stops.map((s, i) => {
              const cat = categoryOf(s.place.categoryId);
              return (
                <li key={s.uid} className="stop">
                  <span className="stop-num" style={{ background: colorOf(s.place.categoryId) }}>
                    {i + 1}
                  </span>
                  <div className="stop-body">
                    <div className="stop-row">
                      <input type="time" value={s.time} onChange={(e) => update(s.uid, { time: e.target.value })} aria-label="Uhrzeit" />
                      <button className="stop-name" onClick={() => onSelect(s.place)}>
                        {cat.emoji} {s.place.name}
                      </button>
                    </div>
                    <input
                      className="stop-note"
                      value={s.note}
                      placeholder="Notiz (z. B. Tisch reserviert)"
                      onChange={(e) => update(s.uid, { note: e.target.value })}
                      aria-label="Notiz"
                    />
                  </div>
                  <div className="stop-tools">
                    <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Nach oben">
                      ↑
                    </button>
                    <button className="icon-btn sm" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Nach unten">
                      ↓
                    </button>
                    <button className="icon-btn sm" onClick={() => setStops(stops.filter((x) => x.uid !== s.uid))} aria-label="Entfernen">
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="plan-summary">
            {stops.length} {stops.length === 1 ? 'Stopp' : 'Stopps'}
            {stops.length > 1 && ` · ${formatDistance(planDistance(stops))} Luftlinie`}
          </p>
          <div className="plan-actions">
            <a className="btn primary" href={planRouteUrl(stops)} target="_blank" rel="noreferrer">
              🧭 Route
            </a>
            <button className="btn" onClick={onShare}>
              🔗 Teilen
            </button>
            <button className="btn" onClick={onCalendar}>
              📅 Kalender
            </button>
            <button className="btn" onClick={onSave}>
              💾 Speichern
            </button>
            <button className="btn ghost" onClick={() => onChange({ title: '', date: plan.date, stops: [] })}>
              Leeren
            </button>
          </div>
        </>
      )}

      {savedPlans.length > 0 && (
        <section className="saved">
          <h3>Gespeicherte Pläne</h3>
          <ul>
            {savedPlans.map((p) => (
              <li key={p.id}>
                <button className="saved-load" onClick={() => onLoad(p)}>
                  <strong>{p.title || 'Ohne Titel'}</strong>
                  <span>
                    {p.date ? new Date(p.date).toLocaleDateString('de-DE') + ' · ' : ''}
                    {p.stops.length} Stopps
                  </span>
                </button>
                <button className="icon-btn sm" onClick={() => onDeleteSaved(p.id)} aria-label="Gespeicherten Plan löschen">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
