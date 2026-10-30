import { useEffect, useState } from 'react';
import type { LatLon } from '../types';
import { searchPlaces, type GeoResult } from '../services/geocode';
import { Icon } from './Icon';

interface Props {
  near: LatLon;
  locating: boolean;
  onPick: (result: GeoResult) => void;
  onLocate: () => void;
}

export function SearchBox({ near, locating, onPick, onLocate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), near, ctrl.signal)
        .then((r) => {
          setResults(r);
          setActive(0);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setResults([]);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // Nur bei neuer Eingabe suchen, nicht wenn sich die Karte bewegt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (r: GeoResult) => {
    onPick(r);
    setQuery(r.label);
    setOpen(false);
  };

  return (
    <div className="searchbox">
      <div className="row">
        <div className="search">
          <input
            type="search"
            placeholder="Ort oder Stadtteil suchen"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (!results.length) return;
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              else if (e.key === 'Enter') pick(results[active]);
              else return;
              e.preventDefault();
            }}
            aria-label="Ort suchen"
          />
        </div>
        <button className="btn-icon" onClick={onLocate} title="Meinen Standort verwenden" aria-label="Meinen Standort verwenden" disabled={locating}>
          {locating ? '…' : <Icon name="location" />}
        </button>
      </div>
      {open && results.length > 0 && (
        <ul className="searchbox-results" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
              >
                <strong>{r.label}</strong>
                {r.detail && <span>{r.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
