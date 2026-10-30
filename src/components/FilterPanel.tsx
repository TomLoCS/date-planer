import type { CriterionId, GroupId } from '../types';
import { CATEGORIES, GROUPS } from '../data/categories';
import { CRITERIA } from '../data/criteria';

/** Umkreis-Regler in Kilometern */
const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 10;

interface Props {
  radius: number;
  onRadius: (r: number) => void;
  categoryIds: string[];
  onToggleCategory: (id: string) => void;
  onToggleGroup: (id: GroupId) => void;
  criteria: CriterionId[];
  onToggleCriterion: (id: CriterionId) => void;
  whenMode: 'now' | 'custom';
  onWhenMode: (m: 'now' | 'custom') => void;
  whenCustom: string;
  onWhenCustom: (v: string) => void;
  showUnknown: boolean;
  onShowUnknown: (v: boolean) => void;
  /** Orte, bei denen ein Kriterium in OSM fehlt */
  unknownCount: number;
}

export function FilterPanel(p: Props) {
  const km = Math.round(p.radius / 1000);
  const pct = ((km - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM)) * 100;

  return (
    <div className="filters stack-lg">
      <section className="stack">
        <h2 className="headline">Was wollt ihr machen?</h2>
        {GROUPS.map((g) => {
          const cats = CATEGORIES.filter((c) => c.group === g.id);
          const all = cats.every((c) => p.categoryIds.includes(c.id));
          return (
            <div key={g.id} className="cat-group">
              <div className="cat-group-head">
                <span className="eyebrow">
                  <span className="dot" style={{ background: g.color }} aria-hidden /> {g.label}
                </span>
                <button className="btn-plain cat-group-all" onClick={() => p.onToggleGroup(g.id)} aria-label={`${g.label}: ${all ? 'alle abwählen' : 'alle auswählen'}`}>
                  {all ? 'Keine' : 'Alle'}
                </button>
              </div>
              <div className="row wrap">
                {cats.map((c) => (
                  <button key={c.id} className="chip" aria-pressed={p.categoryIds.includes(c.id)} onClick={() => p.onToggleCategory(c.id)}>
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="stack">
        <h2 className="headline">Worauf müsst ihr achten?</h2>
        <div className="row wrap">
          {CRITERIA.map((c) => (
            <button key={c.id} className="chip" aria-pressed={p.criteria.includes(c.id)} onClick={() => p.onToggleCriterion(c.id)} title={c.hint}>
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="row radius-head">
          <h2 className="headline">Umkreis</h2>
          <span className="subhead">{km} km</span>
        </div>
        <input
          className="range"
          type="range"
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          step={1}
          value={km}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => p.onRadius(Number(e.target.value) * 1000)}
          aria-label="Umkreis in Kilometern"
        />
      </section>

      <ul className="list">
        <li className="list-row">
          <span>Wann?</span>
          <div className="segmented when-segmented" role="radiogroup" aria-label="Zeitpunkt">
            <button role="radio" aria-checked={p.whenMode === 'now'} onClick={() => p.onWhenMode('now')}>
              Jetzt
            </button>
            <button role="radio" aria-checked={p.whenMode === 'custom'} onClick={() => p.onWhenMode('custom')}>
              Termin
            </button>
          </div>
        </li>
        {p.whenMode === 'custom' && (
          <li className="list-row">
            <span>Termin</span>
            <input className="when-input" type="datetime-local" value={p.whenCustom} onChange={(e) => p.onWhenCustom(e.target.value)} aria-label="Termin" />
          </li>
        )}
        {p.criteria.length > 0 && (
          <li>
            <label className="list-row">
              <span className="list-label">
                Auch Orte ohne Angabe
                <span className="footnote">
                  {p.unknownCount > 0 ? `${p.unknownCount} Orte, bei denen ein Kriterium in OSM fehlt` : 'In OSM fehlt manchmal ein Kriterium'}
                </span>
              </span>
              <input className="switch" type="checkbox" role="switch" checked={p.showUnknown} onChange={(e) => p.onShowUnknown(e.target.checked)} />
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}
