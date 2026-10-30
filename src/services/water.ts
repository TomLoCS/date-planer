import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { Place } from '../types';

/**
 * „Am Wasser" ohne extra Server: Die Kartenkacheln von OpenFreeMap enthalten Seen, Flüsse, Kanäle und Meer
 * (Ebenen `water` und `waterway`). Wir laden die Kacheln rund um die Orte – meist liegen sie schon im
 * Browser-Cache, weil die Karte sie gerade anzeigt – und messen für jeden Ort den Abstand zum nächsten Gewässer.
 */
const TILEJSON = 'https://tiles.openfreemap.org/planet';
export const NEAR_WATER_M = 120;
/** Mehr Kacheln = höhere Zoomstufe = auch kleine Teiche, aber mehr Download */
const MAX_TILES = 12;
const MIN_ZOOM = 10;
const MAX_ZOOM = 14;
const IGNORED_WATER = new Set(['swimming_pool']);
/** Kleinere Wasserflächen ignorieren – sonst zählen Brunnen und Zierbecken als „am Wasser" */
const MIN_WATER_AREA_M2 = 3_000;
const WATERWAYS = new Set(['river', 'canal']);

const M_PER_DEG = 111_320;

type Pt = [number, number];
interface Shape {
  area: boolean;
  parts: Pt[][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

let templatePromise: Promise<string> | null = null;

/** Kachel-URL holen (enthält die aktuelle Datenversion von OpenFreeMap) */
function tileTemplate(): Promise<string> {
  templatePromise ??= fetch(TILEJSON)
    .then((r) => {
      if (!r.ok) throw new Error(`OpenFreeMap: Fehler ${r.status}`);
      return r.json() as Promise<{ tiles: string[] }>;
    })
    .then((j) => j.tiles[0]);
  templatePromise.catch(() => (templatePromise = null)); // beim nächsten Mal neu versuchen
  return templatePromise;
}

/** IDs aller Orte, die ≤ 120 m an einem Gewässer liegen */
export async function findNearWater(places: Place[], signal?: AbortSignal): Promise<Set<string>> {
  const near = new Set<string>();
  if (!places.length) return near;

  // Rechteck um alle Orte + Puffer
  const lats = places.map((p) => p.lat);
  const lons = places.map((p) => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = NEAR_WATER_M / M_PER_DEG;
  const padLon = padLat / Math.cos((midLat * Math.PI) / 180);
  const west = Math.min(...lons) - padLon;
  const east = Math.max(...lons) + padLon;
  const south = Math.min(...lats) - padLat;
  const north = Math.max(...lats) + padLat;

  // Lokales Meter-Koordinatensystem: reicht für Abstände von ein paar Kilometern völlig
  const kx = M_PER_DEG * Math.cos((midLat * Math.PI) / 180);
  const toM = (lon: number, lat: number): Pt => [(lon - west) * kx, (lat - south) * M_PER_DEG];

  const template = await tileTemplate();
  const { z, x0, x1, y0, y1 } = pickTiles(west, south, east, north);
  const jobs: Promise<Shape[]>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadTile(template, z, x, y, toM, signal));
  const shapes = (await Promise.all(jobs)).flat();

  for (const p of places) {
    const [px, py] = toM(p.lon, p.lat);
    if (shapes.some((s) => isNear(px, py, s))) near.add(p.id);
  }
  return near;
}

// --- Kachel-Mathematik (Web-Mercator, wie bei jeder Online-Karte) ---
const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const xToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const yToLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z)) * 180) / Math.PI;

/** Höchste Zoomstufe, bei der das Rechteck in höchstens MAX_TILES Kacheln passt */
function pickTiles(west: number, south: number, east: number, north: number) {
  for (let z = MAX_ZOOM; ; z--) {
    const x0 = Math.floor(lonToX(west, z));
    const x1 = Math.floor(lonToX(east, z));
    const y0 = Math.floor(latToY(north, z));
    const y1 = Math.floor(latToY(south, z));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES || z === MIN_ZOOM) return { z, x0, x1, y0, y1 };
  }
}

async function loadTile(template: string, z: number, x: number, y: number, toM: (lon: number, lat: number) => Pt, signal?: AbortSignal): Promise<Shape[]> {
  const url = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  const res = await fetch(url, { signal });
  if (res.status === 204 || res.status === 404) return []; // leere Kachel
  if (!res.ok) throw new Error(`Kartenkachel: Fehler ${res.status}`);
  const tile = new VectorTile(new PbfReader(await res.arrayBuffer()));

  const shapes: Shape[] = [];
  const water = tile.layers.water;
  for (let i = 0; water && i < water.length; i++) {
    const f = water.feature(i);
    if (f.type !== 3 || IGNORED_WATER.has(String(f.properties.class)) || f.properties.intermittent === 1) continue;
    const shape = toShape(f, true, z, x, y, toM);
    if (areaOf(shape) >= MIN_WATER_AREA_M2) shapes.push(shape);
  }
  const waterway = tile.layers.waterway;
  for (let i = 0; waterway && i < waterway.length; i++) {
    const f = waterway.feature(i);
    if (f.type === 2 && WATERWAYS.has(String(f.properties.class)) && f.properties.brunnel !== 'tunnel') {
      shapes.push(toShape(f, false, z, x, y, toM));
    }
  }
  return shapes;
}

function toShape(f: VectorTileFeature, area: boolean, z: number, x: number, y: number, toM: (lon: number, lat: number) => Pt): Shape {
  const shape: Shape = { area, parts: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const ring of f.loadGeometry()) {
    const part = ring.map((pt): Pt => {
      const m = toM(xToLon(x + pt.x / f.extent, z), yToLat(y + pt.y / f.extent, z));
      shape.minX = Math.min(shape.minX, m[0]);
      shape.minY = Math.min(shape.minY, m[1]);
      shape.maxX = Math.max(shape.maxX, m[0]);
      shape.maxY = Math.max(shape.maxY, m[1]);
      return m;
    });
    shape.parts.push(part);
  }
  return shape;
}

/** Fläche in m² (Gauß'sche Trapezformel; Löcher haben die andere Umlaufrichtung und werden abgezogen) */
function areaOf(s: Shape): number {
  let sum = 0;
  for (const ring of s.parts) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

function isNear(px: number, py: number, s: Shape): boolean {
  const d = NEAR_WATER_M;
  if (px < s.minX - d || px > s.maxX + d || py < s.minY - d || py > s.maxY + d) return false;
  if (s.area && isInside(px, py, s.parts)) return true;
  for (const part of s.parts) {
    for (let i = 1; i < part.length; i++) if (segmentDistance(px, py, part[i - 1], part[i]) <= d) return true;
  }
  return false;
}

/** Punkt-in-Polygon (gerade/ungerade Regel – Inseln/Löcher zählen automatisch richtig) */
function isInside(px: number, py: number, rings: Pt[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function segmentDistance(px: number, py: number, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}
