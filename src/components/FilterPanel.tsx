import type { CriterionId, GroupId } from '../types';
import { CATEGORIES, GROUPS } from '../data/categories';
import { CRITERIA } from '../data/criteria';

const RADII = [1000, 2000, 5000, 10000];

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
}

export function FilterPanel(p: Props) {
  return (
    <div className="filters">
      <div className="filter-row">
        <span className="filter-label">Umkreis</span>
        <div className="segmented" role="radiogroup" aria-label="Umkreis">
          {RADII.map((r) => (
            <button key={r} role="radio" aria-checked={p.radius === r} className={p.radius === r ? 'on' : ''} onClick={() => p.onRadius(r)}>
              {r / 1000} km
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">Wann?</span>
        <div className="segmented" role="radiogroup" aria-label="Zeitpunkt">
          <button role="radio" aria-checked={p.whenMode === 'now'} className={p.whenMode === 'now' ? 'on' : ''} onClick={() => p.onWhenMode('now')}>
            Jetzt
          </button>
          <button role="radio" aria-checked={p.whenMode === 'custom'} className={p.whenMode === 'custom' ? 'on' : ''} onClick={() => p.onWhenMode('custom')}>
            Termin
          </button>
        </div>
      </div>
      {p.whenMode === 'custom' && (
        <input className="when-input" type="datetime-local" value={p.whenCustom} onChange={(e) => p.onWhenCustom(e.target.value)} aria-label="Termin" />
      )}

      <details className="filter-section" open>
        <summary>
          Was wollt ihr machen? <span className="count">{p.categoryIds.length}</span>
        </summary>
        {GROUPS.map((g) => {
          const cats = CATEGORIES.filter((c) => c.group === g.id);
          const all = cats.every((c) => p.categoryIds.includes(c.id));
          return (
            <div key={g.id} className="cat-group">
              <button className="cat-group-title" style={{ ['--group' as string]: g.color }} onClick={() => p.onToggleGroup(g.id)} aria-label={`${g.label}: ${all ? 'alle abwählen' : 'alle auswählen'}`}>
                <span className="dot" /> {g.label}
                <span className="cat-group-all">{all ? 'keine' : 'alle'}</span>
              </button>
              <div className="chips">
                {cats.map((c) => {
                  const on = p.categoryIds.includes(c.id);
                  return (
                    <button key={c.id} className={`chip ${on ? 'on' : ''}`} style={{ ['--group' as string]: g.color }} aria-pressed={on} onClick={() => p.onToggleCategory(c.id)}>
                      <span aria-hidden>{c.emoji}</span> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </details>

      <details className="filter-section" open>
        <summary>
          Worauf müsst ihr achten? <span className="count">{p.criteria.length}</span>
        </summary>
        <div className="chips criteria">
          {CRITERIA.map((c) => {
            const on = p.criteria.includes(c.id);
            return (
              <button key={c.id} className={`chip crit ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => p.onToggleCriterion(c.id)} title={c.hint}>
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
