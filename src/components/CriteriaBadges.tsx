import type { CriterionId, Tri } from '../types';
import { CRITERION_BY_ID } from '../data/criteria';

const SYMBOL: Record<Tri, string> = { yes: '✓', no: '✗', unknown: '?', na: '–' };
const TEXT: Record<Tri, string> = { yes: 'ja', no: 'nein', unknown: 'keine Angabe', na: 'nicht relevant' };

/** Kleine Kriterien-Marken wie „🐕 ✓" oder „🥗 ?" */
export function CriteriaBadges({ results, compact }: { results: Partial<Record<CriterionId, Tri>>; compact?: boolean }) {
  const entries = Object.entries(results) as [CriterionId, Tri][];
  if (!entries.length) return null;
  return (
    <span className={`badges ${compact ? 'compact' : ''}`}>
      {entries.map(([id, r]) => {
        const c = CRITERION_BY_ID[id];
        return (
          <span key={id} className={`badge ${r}`} title={`${c.label}: ${TEXT[r]}`}>
            {c.emoji}
            <b>{SYMBOL[r]}</b>
            {!compact && <span className="badge-label">{c.label}</span>}
          </span>
        );
      })}
    </span>
  );
}
