import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CriterionId, GroupId, LatLon, Place, Plan, SavedPlan } from './types';
import { CATEGORIES, DEFAULT_CATEGORIES, categoryOf } from './data/categories';
import { CRITERION_BY_ID, evaluatePlace, type CriterionContext } from './data/criteria';
import { checkNearWater, fetchPlaces, isDemoMode } from './services/places';
import { GEOAPIFY_ATTRIBUTION, hasGeoapifyKey } from './services/geoapify';
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
import { Icon, type IconName } from './components/Icon';

const DEFAULT_CENTER: LatLon = { lat: 52.52, lon: 13.405 };
const EMPTY_PLAN: Plan = { title: '', date: '', stops: [] };

type Tab = 'discover' | 'plan' | 'favorites';
/** Aktivität = blauer Akzent, Date = Rosé (siehe planner-ui.css) */
type Mode = 'activity' | 'date';
type Sort = 'best' | 'near';

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
  const [mode, setMode] = useLocalStorage<Mode>('dp.mode', 'activity');
  const [sort, setSort] = useState<Sort>('best');
  const [whenMode, setWhenMode] = useState<'now' | 'custom'>('now');
  const [whenCustom, setWhenCustom] = useState(tonightAt19);
  const [now, setNow] = useState(() => new Date());

  // --- Plan & Favoriten ---
  const [plan, setPlan] = useLocalStorage<Plan>('dp.plan', EMPTY_PLAN);
  const [savedPlans, setSavedPlans] = useLocalStorage<SavedPlan[]>('dp.savedPlans', []);
  const [favorites, setFavorites] = useLocalStorage<Place[]>('dp.favorites', []);
  const [sharedPlan, setSharedPlan] = useState<Plan | null>(() => planFromHash(location.hash));

  // --- Ergebnisse & UI ---
  const [fetched, setFetched] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Suche Orte …');
  const [nearWater, setNearWater] = useState<Set<string> | null>(null);
  const [waterLoading, setWaterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Place | null>(null);
  const [tab, setTab] = useState<Tab>('discover');
  const [flyTo, setFlyTo] = useState<FlyTarget>();
  const [mapCenter, setMapCenter] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [suggestion, setSuggestion] = useState<Place[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [accent, setAccent] = useState('#0071e3');

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

  // Modus an <html data-mode> hängen → CSS tauscht die Akzentfarbe; die Karte bekommt sie als Wert
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'date') root.dataset.mode = 'date';
    else delete root.dataset.mode;
    setAccent(getComputedStyle(root).getPropertyValue('--accent').trim() || '#0071e3');
  }, [mode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Orte laden – mit kurzer Pause, damit schnelles Klicken nicht zig Anfragen auslöst (spart Credits)
  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    if (!categoryIds.length) {
      setFetched([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setStatus('Suche Orte …');
    const timer = setTimeout(() => {
      fetchPlaces({ center, radius, categoryIds }, ctrl.signal, setStatus)
        .then((res) => {
          setFetched(res);
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
  }, [center.lat, center.lon, radius, categoryKey, retry]);

  // „Am Wasser" separat prüfen (aus den Kartenkacheln) – das Kriterium löst so keine neue Orts-Suche aus
  useEffect(() => {
    setNearWater(null);
    if (!withWater || !fetched.length) {
      setWaterLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setWaterLoading(true);
    checkNearWater(fetched, ctrl.signal)
      .then((ids) => {
        setNearWater(ids);
        setWaterLoading(false);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        console.warn(e); // dann bleibt „Am Wasser" bei allen Orten unbekannt (?)
        setWaterLoading(false);
      });
    return () => ctrl.abort();
  }, [fetched, withWater]);

  const places = useMemo(
    () => (nearWater ? fetched.map((p) => ({ ...p, nearWater: nearWater.has(p.id) })) : fetched),
    [fetched, nearWater],
  );

  const when = useMemo(() => (whenMode === 'now' ? now : new Date(whenCustom)), [whenMode, now, whenCustom]);
  const ctx: CriterionContext = useMemo(() => ({ when, waterChecked: withWater && nearWater !== null }), [when, withWater, nearWater]);

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
        .sort((a, b) => (sort === 'best' ? b.ev.score - a.ev.score : 0) || a.dist - b.dist),
    [evaluated, showUnknown, sort],
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
  const criteriaText = criteria.map((c) => CRITERION_BY_ID[c].label).join(' · ');
  const today = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: 'discover', label: 'Entdecken', icon: 'search' },
    { id: 'plan', label: 'Pläne', icon: 'calendar', count: plan.stops.length },
    { id: 'favorites', label: 'Favoriten', icon: 'heart', count: favorites.length },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="nav side-nav">
          <div className="nav-bar">
            <span className="nav-title brand">
              <span className="logo" aria-hidden>
                ♥
              </span>
              Date Planer
            </span>
          </div>
        </header>

        <div className="tab-body" key={tab}>
          {sharedPlan && (
            <div className="banner stack">
              <p className="subhead">
                <strong>Dir wurde ein Plan geschickt:</strong> {sharedPlan.title || 'Ohne Titel'} ({sharedPlan.stops.length} Stopps)
              </p>
              <div className="row">
                <button className="btn btn-primary btn-sm" onClick={acceptShared}>
                  Ansehen
                </button>
                <button className="btn btn-plain btn-sm" onClick={dismissShared}>
                  Ignorieren
                </button>
              </div>
            </div>
          )}

          {tab === 'discover' && (
            <div className="stack-lg">
              <header className="page-head">
                <p className="eyebrow">{today}</p>
                <h1 className="large-title">Was habt ihr vor?</h1>
              </header>

              <div className="segmented" role="radiogroup" aria-label="Modus">
                <button role="radio" aria-checked={mode === 'activity'} onClick={() => setMode('activity')}>
                  Aktivität
                </button>
                <button role="radio" aria-checked={mode === 'date'} onClick={() => setMode('date')}>
                  Date
                </button>
              </div>

              <div className="stack">
                <SearchBox near={center} locating={locating} onPick={onPickLocation} onLocate={onLocate} />
                <p className="footnote">
                  Suche um <strong className="where">{centerLabel}</strong>
                </p>
                {isDemoMode() && <p className="demo-note footnote">Demo-Modus: fiktive Beispiel-Orte rund um Berlin-Mitte (URL ohne „?demo" öffnen für echte Daten)</p>}
              </div>

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
                showUnknown={showUnknown}
                onShowUnknown={setShowUnknown}
                unknownCount={partialCount}
              />

              <section className="results stack">
                <div className="results-head">
                  <div>
                    <h2 className="title-2">In deiner Nähe</h2>
                    <p className="subhead" aria-live="polite">
                      {loading || waterLoading ? (
                        <span className="loading">{loading ? status : 'Prüfe, was am Wasser liegt …'}</span>
                      ) : error ? (
                        'Gerade keine Daten'
                      ) : !categoryIds.length ? (
                        'Wähle oben mindestens eine Kategorie.'
                      ) : (
                        <>
                          {matchCount} {matchCount === 1 ? 'Ort' : 'Orte'} · bis {Math.round(radius / 1000)} km
                          {criteriaText && ` · ${criteriaText}`}
                        </>
                      )}
                    </p>
                  </div>
                  <button className="btn-icon" onClick={rollSurprise} disabled={loading || !visible.length} title="Überrasch mich: zufälliges Date aus den Treffern" aria-label="Überrasch mich">
                    <Icon name="dice" />
                  </button>
                </div>

                {visible.length > 1 && (
                  <div className="row wrap">
                    <button className="chip" aria-pressed={sort === 'best'} onClick={() => setSort('best')}>
                      Beste Treffer
                    </button>
                    <button className="chip" aria-pressed={sort === 'near'} onClick={() => setSort('near')}>
                      Nächste
                    </button>
                  </div>
                )}

                {error && (
                  <div className="error stack">
                    <p className="subhead">{error}</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => setRetry((r) => r + 1)}>
                      Nochmal versuchen
                    </button>
                  </div>
                )}

                {suggestion && (
                  <div className="suggestion stack">
                    <div className="row">
                      <Icon name="dice" />
                      <h3 className="headline">Wie wär's damit?</h3>
                    </div>
                    <ol className="list">
                      {suggestion.map((p, i) => (
                        <li key={p.id}>
                          <button className="list-row" onClick={() => selectPlace(p)}>
                            <span className="footnote sugg-time">{surpriseTimes(suggestion.length)[i]}</span>
                            <span>
                              {categoryOf(p.categoryId).emoji} {p.name}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <div className="row wrap">
                      <button className="btn btn-primary btn-sm" onClick={applySuggestion}>
                        Als Plan übernehmen
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={rollSurprise}>
                        Nochmal würfeln
                      </button>
                      <button className="btn btn-plain btn-sm" onClick={() => setSuggestion(null)}>
                        Schließen
                      </button>
                    </div>
                  </div>
                )}

                {!loading && !waterLoading && !error && categoryIds.length > 0 && visible.length === 0 && (
                  <div className="empty stack">
                    <p className="headline">Nichts gefunden, das sicher passt</p>
                    <p className="subhead">Tipp: Umkreis vergrößern, mehr Kategorien wählen oder „Auch Orte ohne Angabe" einschalten.</p>
                  </div>
                )}

                <PlaceList items={visible} selectedId={selected?.id} onSelect={(p) => selectPlace(p)} />
              </section>

              <footer className="credits footnote">
                Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende
                {hasGeoapifyKey() && (
                  <>
                    {' '}
                    via{' '}
                    <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
                      Geoapify
                    </a>
                  </>
                )}{' '}
                · Karte{' '}
                <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · Suche{' '}
                <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a>
              </footer>
            </div>
          )}

          {tab === 'plan' && (
            <div className="stack-lg">
              <header className="page-head">
                <p className="eyebrow">{plan.date ? new Date(plan.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Euer Date'}</p>
                <h1 className="large-title">Pläne</h1>
              </header>
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
            </div>
          )}

          {tab === 'favorites' && (
            <div className="stack-lg">
              <header className="page-head">
                <p className="eyebrow">{favorites.length === 1 ? '1 Ort gemerkt' : `${favorites.length} Orte gemerkt`}</p>
                <h1 className="large-title">Favoriten</h1>
              </header>
              <FavoritesPanel favorites={favorites} onSelect={(p) => selectPlace(p)} onRemove={toggleFavorite} onAddToPlan={addToPlan} />
            </div>
          )}
        </div>

        <nav className="tabbar" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={26} />
              {t.label}
              {!!t.count && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="map-wrap">
        <MapView
          center={center}
          radius={radius}
          places={mapPlaces}
          accent={accent}
          attribution={hasGeoapifyKey() ? GEOAPIFY_ATTRIBUTION : undefined}
          selectedId={selected?.id}
          planStops={plan.stops}
          flyTo={flyTo}
          onSelect={(p) => selectPlace(p, false)}
          onUserMove={setMapCenter}
        />
        {showSearchHere && (
          <button className="search-here btn btn-primary btn-sm" onClick={searchHere}>
            <Icon name="search" /> In diesem Bereich suchen
          </button>
        )}
        {loading && <div className="map-loading footnote">{status === 'Suche Orte …' ? 'Lade Orte …' : status}</div>}
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
