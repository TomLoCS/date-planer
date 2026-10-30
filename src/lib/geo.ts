import type { LatLon } from '../types';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Luftlinie in Metern */
export function distance(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0).replace('.', ',')} km`;
}

/** Kreis als Polygon (für die Umkreis-Anzeige auf der Karte), Ring als [lon, lat]-Liste */
export function circlePolygon(center: LatLon, radiusM: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  const latR = radiusM / R;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const lat = center.lat + (latR * Math.sin(angle) * 180) / Math.PI;
    const lon = center.lon + ((latR * Math.cos(angle)) / Math.cos(rad(center.lat))) * (180 / Math.PI);
    coords.push([lon, lat]);
  }
  return coords;
}

/** Rechteck um den Suchkreis als [[West, Süd], [Ost, Nord]] – für fitBounds */
export function boundsForRadius(center: LatLon, radiusM: number): [[number, number], [number, number]] {
  const dLat = (radiusM / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos(rad(center.lat));
  return [
    [center.lon - dLon, center.lat - dLat],
    [center.lon + dLon, center.lat + dLat],
  ];
}
