import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CriterionId, GroupId, LatLon, Place, Plan, SavedPlan } from './types';
import { CATEGORIES, DEFAULT_CATEGORIES, categoryOf } from './data/categories';
import { CRITERION_BY_ID, evaluatePlace, type CriterionContext } from './data/criteria';
import { fetchPlaces, isDemoMode } from './services/overpass';
import { reverseGeocode, type GeoResult } from './services/geocode';
import { distance } from './lib/geo';
import { useLocalStorage } from './lib/storage';
import { uid } from './lib/format';
import { downloadFile, planFromHash, planShareUrl, planToIcs } from './lib/share';
import { surpriseDate, surpriseTimes } from './lib/surprise';
import { MapView, type FlyTarget } from './components/MapView';
import { SearchBox } from './components/SearchBox';
import { FilterPanel } from './components/FilterPanel';
import { PlaceList, type ListItem } from './components/PlaceList';
import { PlaceDetail } from './components/PlaceDetail';
import { PlanPanel } from './components/PlanPanel';
import { FavoritesPanel } from './components/FavoritesPanel';

const DEFAULT_CENTER: LatLon = { lat: 52.52, lon: 13.405 };
const EMPTY_PLAN: Plan = { title: '', date: '', stops: [] };

type Tab = 'discover' | 'plan' | 'favorites';

function localDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tonightAt19(): string {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  return localDateTime(d);
}

export default function App() {
  // --- Suche (wird im Browser gemerkt) ---
  const [center, setCenter] = useLocalStorage<LatLon>('dp.center', DEFAULT_CENTER);
  const [centerLabel, setCenterLabel] = useLocalStorage('dp.centerLabel', 'Berlin');
  const [radius, setRadius] = useLocalStorage('dp.radius', 2000);
  const [categoryIds, setCategoryIds] = useLocalStorage<string[]>('dp.categories', DEFAULT_CATEGORIES);
  const [criteria, setCriteria] = useLocalStorage<CriterionId[]>('dp.criteria', []);
  const [showUnknown, setShowUnknown] = useLocalStorage('dp.showUnknown', false);
  const [whenMode, setWhenMode] = useState<'now' | 'custom'>('now');
  const [whenCustom, setWhenCustom] = useState(tonightAt19);
  const [now, setNow] = useState(() => new Date());

  // --- Plan & Favoriten ---
  const [plan, setPlan] = useLocalStorage<Plan>('dp.plan', EMPTY_PLAN);
  const [savedPlans, setSavedPlans] = useLocalStorage<SavedPlan[]>('dp.savedPlans', []);
  const [favorites, setFavorites] = useLocalStorage<Place[]>('dp.favorites', []);
  const [sharedPlan, setSharedPlan] = useState<Plan | null>(() => planFromHash(location.hash));

  // --- Ergebnisse & UI ---
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Place | null>(null);
  const [tab, setTab] = useState<Tab>('discover');
  const [flyTo, setFlyTo] = useState<FlyTarget>();
  const [mapCenter, setMapCenter] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [suggestion, setSuggestion] = useState<Place[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const withWater = criteria.includes('water');
  const categoryKey = categoryIds.join(',');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    // Geteilter Link wird bei schon offener App eingefügt → trotzdem erkennen
    const onHash = () => setSharedPlan(planFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => {
      clearInterval(t);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Orte laden – mit kurzer Pause, damit schnelles Klicken nicht zig Anfragen auslöst (Fair Use)
  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    if (!categoryIds.length) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setAttempt(1);
    const timer = setTimeout(() => {
      fetchPlaces({ center, radius, categoryIds, withWater }, ctrl.signal, (a) => setAttempt(a))
        .then((res) => {
          setPlaces(res);
          setLoading(false);
        })
        .catch((e: Error) => {
          if (ctrl.signal.aborted) return;
          setError(e.message);
          setLoading(false);
        });
    }, 650);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // categoryKey statt categoryIds, damit gleiche Auswahl keine neue Anfrage auslöst
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lon, radius, categoryKey, withWater, retry]);

  const when = useMemo(() => (whenMode === 'now' ? now : new Date(whenCustom)), [whenMode, now, whenCustom]);
  const ctx: CriterionContext = useMemo(() => ({ when, waterChecked: withWater }), [when, withWater]);

  const evaluated: ListItem[] = useMemo(
    () =>
      places.map((place) => ({
        place,
        ev: evaluatePlace(place, criteria, ctx),
        dist: distance(center, place),
        open: CRITERION_BY_ID.open.evaluate(place, ctx),
      })),
    [places, criteria, ctx, center],
  );

  const matchCount = evaluated.filter((x) => x.ev.level === 'match').length;
  const partialCount = evaluated.filter((x) => x.ev.level === 'partial').length;

  const visible = useMemo(
    () =>
      evaluated
        .filter((x) => x.ev.level === 'match' || (showUnknown && x.ev.level === 'partial'))
        .sort((a, b) => b.ev.score - a.ev.score || a.dist - b.dist),
    [evaluated, showUnknown],
  );

  const mapPlaces = useMemo(() => visible.map((x) => ({ place: x.place, partial: x.ev.level === 'partial' })), [visible]);

  // --- Aktionen ---
  const selectPlace = useCallback(
    (place: Place, fly = true) => {
      const fresh = places.find((p) => p.id === place.id) ?? favorites.find((p) => p.id === place.id) ?? place;
      setSelected(fresh);
      if (fly) setFlyTo({ lat: fresh.lat, lon: fresh.lon, key: Date.now() });
    },
    [places, favorites],
  );

  const moveTo = (to: LatLon, label: string) => {
    setCenter({ lat: to.lat, lon: to.lon });
    setCenterLabel(label);
    setMapCenter(null);
    setSelected(null);
    setFlyTo({ lat: to.lat, lon: to.lon, radius, key: Date.now() });
  };

  const labelFor = (at: LatLon, fallback: string) => {
    setCenterLabel(fallback);
    reverseGeocode(at)
      .then((name) => name && setCenterLabel(name))
      .catch(() => undefined);
  };

  const onPickLocation = (r: GeoResult) => moveTo(r, r.label);

  const onLocate = () => {
    if (!navigator.geolocation) {
      setToast('Standort wird von diesem Browser nicht unterstützt.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        moveTo(at, 'Mein Standort');
        labelFor(at, 'Mein Standort');
      },
      () => {
        setLocating(false);
        setToast('Standort nicht verfügbar – such einfach oben nach deiner Stadt.');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const searchHere = () => {
    if (!mapCenter) return;
    setCenter(mapCenter);
    labelFor(mapCenter, 'Kartenausschnitt');
    setMapCenter(null);
  };

  const toggleCategory = (id: string) =>
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const toggleGroup = (group: GroupId) => {
    const groupIds = CATEGORIES.filter((c) => c.group === group).map((c) => c.id);
    setCategoryIds((ids) =>
      groupIds.every((id) => ids.includes(id)) ? ids.filter((id) => !groupIds.includes(id)) : [...new Set([...ids, ...groupIds])],
    );
  };

  const toggleCriterion = (id: CriterionId) =>
    setCriteria((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const inPlan = (place: Place) => plan.stops.some((s) => s.place.id === place.id);
  const isFavorite = (place: Place) => favorites.some((f) => f.id === place.id);

  const addToPlan = (place: Place) => {
    if (inPlan(place)) return;
    setPlan((p) => ({ ...p, stops: [...p.stops, { uid: uid(), place, time: '', note: '' }] }));
    setToast(`„${place.name}" ist jetzt im Plan`);
  };

  const toggleFavorite = (place: Place) =>
    setFavorites((list) => (list.some((f) => f.id === place.id) ? list.filter((f) => f.id !== place.id) : [place, ...list]));

  const rollSurprise = () => {
    const stops = surpriseDate(visible.map((x) => x.place));
    if (!stops.length) {
      setToast('Keine passenden Orte zum Würfeln – Filter etwas lockern?');
      return;
    }
    setSuggestion(stops);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    const times = surpriseTimes(suggestion.length);
    setPlan({
      title: 'Zufalls-Date 🎲',
      date: plan.date || (whenMode === 'custom' ? whenCustom.slice(0, 10) : localDateTime(new Date()).slice(0, 10)),
      stops: suggestion.map((place, i) => ({ uid: uid(), place, time: times[i], note: '' })),
    });
    setSuggestion(null);
    setTab('plan');
  };

  const sharePlan = async () => {
    const url = planShareUrl(plan);
    try {
      if (navigator.share) {
        await navigator.share({ title: plan.title || 'Unser Date', text: 'Schau mal, unser Plan:', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Link kopiert – einfach per WhatsApp & Co. schicken');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') window.prompt('Link kopieren:', url);
    }
  };

  const exportCalendar = () => {
    const name = (plan.title || 'date').replace(/[^\wäöüÄÖÜß-]+/g, '-').toLowerCase();
    downloadFile(`${name}.ics`, planToIcs(plan), 'text/calendar;charset=utf-8');
  };

  const savePlan = () => {
    const entry: SavedPlan = { ...plan, id: uid(), savedAt: new Date().toISOString() };
    setSavedPlans((list) => [entry, ...list].slice(0, 30));
    setToast('Plan gespeichert');
  };

  const acceptShared = () => {
    if (!sharedPlan) return;
    setPlan(sharedPlan);
    setSharedPlan(null);
    history.replaceState(null, '', location.pathname + location.search);
    setTab('plan');
    const first = sharedPlan.stops[0]?.place;
    if (first) setFlyTo({ lat: first.lat, lon: first.lon, zoom: 14, key: Date.now() });
  };

  const dismissShared = () => {
    setSharedPlan(null);
    history.replaceState(null, '', location.pathname + location.search);
  };

  const showSearchHere = mapCenter !== null && distance(mapCenter, center) > radius * 0.25;
  const activeCriteriaLabels = criteria.map((c) => CRITERION_BY_ID[c].emoji).join(' ');

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <span className="logo" aria-hidden>
            ♥
          </span>
          <div>
            <h1>Date Planer</h1>
            <p>Dates & Freizeit nach euren Kriterien</p>
          </div>
        </header>

        {sharedPlan && (
          <div className="banner">
            <p>
              <strong>Dir wurde ein Plan geschickt:</strong> {sharedPlan.title || 'Ohne Titel'} ({sharedPlan.stops.length} Stopps)
            </p>
            <div>
              <button className="btn primary sm" onClick={acceptShared}>
                Ansehen
              </button>
              <button className="btn ghost sm" onClick={dismissShared}>
                Ignorieren
              </button>
            </div>
          </div>
        )}

        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'discover'} className={tab === 'discover' ? 'on' : ''} onClick={() => setTab('discover')}>
            Entdecken
          </button>
          <button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>
            Plan {plan.stops.length > 0 && <span className="pill">{plan.stops.length}</span>}
          </button>
          <button role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>
            Gemerkt {favorites.length > 0 && <span className="pill">{favorites.length}</span>}
          </button>
        </nav>

        <div className="tab-body" key={tab}>
          {tab === 'discover' && (
            <>
              <SearchBox near={center} locating={locating} onPick={onPickLocation} onLocate={onLocate} />
              <p className="where">
                Suche um <strong>{centerLabel}</strong>
              </p>
              {isDemoMode() && <p className="demo-note">🧪 Demo-Modus: fiktive Beispiel-Orte rund um Berlin-Mitte (URL ohne „?demo" öffnen für echte Daten)</p>}
              <FilterPanel
                radius={radius}
                onRadius={(r) => {
                  setRadius(r);
                  setFlyTo({ ...center, radius: r, key: Date.now() });
                }}
                categoryIds={categoryIds}
                onToggleCategory={toggleCategory}
                onToggleGroup={toggleGroup}
                criteria={criteria}
                onToggleCriterion={toggleCriterion}
                whenMode={whenMode}
                onWhenMode={setWhenMode}
                whenCustom={whenCustom}
                onWhenCustom={setWhenCustom}
              />

              <div className="results-head">
                <div className="results-count">
                  {loading ? (
                    <span className="loading">{attempt > 1 ? `Server überlastet – Ausweichserver ${attempt} …` : 'Suche Orte …'}</span>
                  ) : error ? null : !categoryIds.length ? (
                    <span>Wähle oben mindestens eine Kategorie.</span>
                  ) : (
                    <span>
                      <strong>{matchCount}</strong> {matchCount === 1 ? 'passender Ort' : 'passende Orte'} {activeCriteriaLabels}
                    </span>
                  )}
                </div>
                <button className="btn sm" onClick={rollSurprise} disabled={loading || !visible.length} title="Zufälliges Date aus den Treffern">
                  🎲 Überrasch mich
                </button>
              </div>

              {error && (
                <div className="error">
                  <p>{error}</p>
                  <button className="btn sm" onClick={() => setRetry((r) => r + 1)}>
                    Nochmal versuchen
                  </button>
                </div>
              )}

              {!loading && criteria.length > 0 && partialCount > 0 && (
                <button className="unknown-toggle" onClick={() => setShowUnknown((v) => !v)}>
                  {showUnknown
                    ? `Orte ohne Angabe ausblenden (${partialCount})`
                    : `+ ${partialCount} Orte ohne Angabe einblenden`}
                  <span className="hint"> – in OpenStreetMap fehlt dort ein Kriterium</span>
                </button>
              )}

              {suggestion && (
                <div className="suggestion">
                  <h3>🎲 Wie wär's damit?</h3>
                  <ol>
                    {suggestion.map((p, i) => (
                      <li key={p.id}>
                        <span className="sugg-time">{surpriseTimes(suggestion.length)[i]}</span>
                        <button className="link" onClick={() => selectPlace(p)}>
                          {categoryOf(p.categoryId).emoji} {p.name}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div className="suggestion-actions">
                    <button className="btn primary sm" onClick={applySuggestion}>
                      Als Plan übernehmen
                    </button>
                    <button className="btn sm" onClick={rollSurprise}>
                      Nochmal würfeln
                    </button>
                    <button className="btn ghost sm" onClick={() => setSuggestion(null)}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && categoryIds.length > 0 && visible.length === 0 && (
                <div className="empty">
                  <p>Nichts gefunden, das sicher passt.</p>
                  <p className="hint">Tipp: Umkreis vergrößern, mehr Kategorien wählen oder „Orte ohne Angabe" einblenden.</p>
                </div>
              )}

              <PlaceList items={visible} selectedId={selected?.id} onSelect={(p) => selectPlace(p)} />
            </>
          )}

          {tab === 'plan' && (
            <PlanPanel
              plan={plan}
              savedPlans={savedPlans}
              onChange={setPlan}
              onSelect={(p) => selectPlace(p)}
              onShare={sharePlan}
              onCalendar={exportCalendar}
              onSave={savePlan}
              onLoad={(p) => {
                setPlan({ title: p.title, date: p.date, stops: p.stops });
                setToast('Plan geladen');
              }}
              onDeleteSaved={(id) => setSavedPlans((list) => list.filter((p) => p.id !== id))}
              onDiscover={() => setTab('discover')}
            />
          )}

          {tab === 'favorites' && (
            <FavoritesPanel favorites={favorites} onSelect={(p) => selectPlace(p)} onRemove={toggleFavorite} onAddToPlan={addToPlan} />
          )}
        </div>

        <footer className="credits">
          Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende · Karte{' '}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · Suche{' '}
          <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a>
        </footer>
      </aside>

      <main className="map-wrap">
        <MapView
          center={center}
          radius={radius}
          places={mapPlaces}
          selectedId={selected?.id}
          planStops={plan.stops}
          flyTo={flyTo}
          onSelect={(p) => selectPlace(p, false)}
          onUserMove={setMapCenter}
        />
        {showSearchHere && (
          <button className="search-here btn primary" onClick={searchHere}>
            🔍 In diesem Bereich suchen
          </button>
        )}
        {loading && <div className="map-loading">{attempt > 1 ? `Ausweichserver ${attempt} …` : 'Lade Orte …'}</div>}
        {selected && (
          <PlaceDetail
            key={selected.id}
            place={selected}
            ctx={ctx}
            dist={distance(center, selected)}
            isFavorite={isFavorite(selected)}
            inPlan={inPlan(selected)}
            onAddToPlan={() => addToPlan(selected)}
            onToggleFavorite={() => toggleFavorite(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
