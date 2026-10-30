import { useEffect, useRef, useState } from 'react';
import { MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLon, Place, PlanStop } from '../types';
import { categoryOf, colorOf } from '../data/categories';
import { boundsForRadius, circlePolygon } from '../lib/geo';

// OpenFreeMap: kostenlose Vektor-Karten ohne API-Key und ohne Limit.
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const ACCENT = '#e5484d';

// Vite bündelt maplibre vor; der Worker muss daher explizit als eigene Datei angegeben werden.
setWorkerUrl(workerUrl);

export interface FlyTarget extends LatLon {
  zoom?: number;
  /** gesetzt → Ausschnitt so wählen, dass dieser Suchradius ganz zu sehen ist */
  radius?: number;
  key: number;
}

export interface MapPlace {
  place: Place;
  partial: boolean;
}

interface Props {
  center: LatLon;
  radius: number;
  places: MapPlace[];
  selectedId?: string;
  planStops: PlanStop[];
  flyTo?: FlyTarget;
  onSelect: (place: Place) => void;
  onUserMove: (center: LatLon) => void;
  /** zusätzlicher Quellen-Hinweis unten rechts auf der Karte (z. B. „Powered by Geoapify") */
  attribution?: string;
}

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function MapView({ center, radius, places, selectedId, planStops, flyTo, onSelect, onUserMove, attribution }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const centerMarker = useRef<Marker | null>(null);
  const planMarkers = useRef<Marker[]>([]);

  // Aktuelle Props für die Event-Handler, die nur einmal registriert werden
  const latest = useRef({ places, planStops, onSelect, onUserMove });
  useEffect(() => {
    latest.current = { places, planStops, onSelect, onUserMove };
  });

  // Karte einmalig anlegen
  useEffect(() => {
    if (!containerRef.current) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        bounds: boundsForRadius(center, radius),
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true, customAttribution: attribution },
      });
    } catch (e) {
      setError(`Karte konnte nicht geladen werden: ${(e as Error).message}`);
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.addSource('radius', { type: 'geojson', data: emptyFC });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': ACCENT, 'fill-opacity': 0.035 } });
      map.addLayer({
        id: 'radius-line', type: 'line', source: 'radius',
        paint: { 'line-color': ACCENT, 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.55 },
      });

      map.addSource('plan', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'plan-line', type: 'line', source: 'plan',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ACCENT, 'line-width': 3, 'line-dasharray': [1.2, 1.6] },
      });

      map.addSource('places', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'places-halo', type: 'circle', source: 'places', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 16, 'circle-color': ['get', 'color'], 'circle-opacity': 0.22, 'circle-stroke-width': 2, 'circle-stroke-color': ['get', 'color'] },
      });
      map.addLayer({
        id: 'places', type: 'circle', source: 'places',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7, 17, 10],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['case', ['get', 'partial'], 0.4, 1],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': ['case', ['get', 'partial'], 0.5, 1],
        },
      });
      setReady(true);
    });

    const hover = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'hover-popup' });
    map.on('mouseenter', 'places', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      hover.setLngLat(f.geometry.coordinates as [number, number]).setText(String(f.properties?.label ?? '')).addTo(map);
    });
    map.on('mouseleave', 'places', () => {
      map.getCanvas().style.cursor = '';
      hover.remove();
    });
    map.on('click', 'places', (e) => {
      const id = e.features?.[0]?.properties?.id;
      const hit = latest.current.places.find((p) => p.place.id === id);
      if (hit) latest.current.onSelect(hit.place);
    });
    map.on('moveend', (e) => {
      // Nur echte Nutzer-Bewegungen (Ziehen/Zoomen), nicht flyTo aus der App
      if (!(e as { originalEvent?: Event }).originalEvent) return;
      const c = map.getCenter();
      latest.current.onUserMove({ lat: c.lat, lon: c.lng });
    });

    const resize = new ResizeObserver(() => map.resize());
    resize.observe(containerRef.current);

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      centerMarker.current = null;
      planMarkers.current = [];
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Orte
  useEffect(() => {
    if (!ready) return;
    const features: GeoJSON.Feature[] = places.map(({ place, partial }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
      properties: {
        id: place.id,
        color: colorOf(place.categoryId),
        partial,
        label: `${categoryOf(place.categoryId).emoji} ${place.name}`,
      },
    }));
    (mapRef.current?.getSource('places') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [ready, places]);

  // Auswahl hervorheben
  useEffect(() => {
    if (!ready) return;
    mapRef.current?.setFilter('places-halo', ['==', ['get', 'id'], selectedId ?? '']);
  }, [ready, selectedId]);

  // Suchradius + Mittelpunkt
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('radius') as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circlePolygon(center, radius)] },
      properties: {},
    });
    if (!centerMarker.current) {
      const el = document.createElement('div');
      el.className = 'center-dot';
      el.title = 'Suchmittelpunkt';
      centerMarker.current = new Marker({ element: el }).setLngLat([center.lon, center.lat]).addTo(map);
    } else {
      centerMarker.current.setLngLat([center.lon, center.lat]);
    }
  }, [ready, center, radius]);

  // Plan: Linie + nummerierte Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('plan') as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: planStops.map((s) => [s.place.lon, s.place.lat]) },
      properties: {},
    });
    planMarkers.current.forEach((m) => m.remove());
    planMarkers.current = planStops.map((stop, i) => {
      const el = document.createElement('button');
      el.className = 'plan-marker';
      el.textContent = String(i + 1);
      el.title = stop.place.name;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        latest.current.onSelect(stop.place);
      });
      return new Marker({ element: el, anchor: 'bottom' }).setLngLat([stop.place.lon, stop.place.lat]).addTo(map);
    });
  }, [ready, planStops]);

  // Hinfliegen
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.radius) {
      map.fitBounds(boundsForRadius(flyTo, flyTo.radius), { padding: 24, duration: 1200 });
      return;
    }
    // Auf dem Desktop liegt rechts die Detail-Karte (360 px) – Ort in die freie Fläche daneben setzen
    const wide = map.getContainer().clientWidth > 760;
    map.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: flyTo.zoom ?? Math.max(map.getZoom(), 15),
      padding: { top: 0, bottom: 0, left: 0, right: wide ? 380 : 0 },
      essential: true,
      speed: 1.6,
    });
  }, [flyTo]);

  return (
    <div className="map" ref={containerRef}>
      {error && <div className="map-error">{error}</div>}
    </div>
  );
}
