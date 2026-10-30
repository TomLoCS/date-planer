import type { Plan, PlanStop } from '../types';
import { categoryOf } from '../data/categories';
import { distance } from './geo';
import { addressText, osmUrl, uid } from './format';

// ---------- Plan als Link teilen (ohne Server: alles steckt im #plan=… der URL) ----------

type SharedStop = [name: string, lat: number, lon: number, categoryId: string, time: string, note: string, osmId: string];
interface SharedPlan {
  v: 1;
  t: string;
  d: string;
  s: SharedStop[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function planToHash(plan: Plan): string {
  const shared: SharedPlan = {
    v: 1,
    t: plan.title,
    d: plan.date,
    s: plan.stops.map((s) => [
      s.place.name,
      +s.place.lat.toFixed(6),
      +s.place.lon.toFixed(6),
      s.place.categoryId,
      s.time,
      s.note,
      s.place.id,
    ]),
  };
  return `#plan=${toBase64Url(JSON.stringify(shared))}`;
}

export function planShareUrl(plan: Plan): string {
  return `${location.origin}${location.pathname}${planToHash(plan)}`;
}

export function planFromHash(hash: string): Plan | null {
  const m = hash.match(/plan=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const shared = JSON.parse(fromBase64Url(m[1])) as SharedPlan;
    if (shared.v !== 1 || !Array.isArray(shared.s)) return null;
    return {
      title: shared.t ?? '',
      date: shared.d ?? '',
      stops: shared.s.map(([name, lat, lon, categoryId, time, note, id]) => ({
        uid: uid(),
        time: time ?? '',
        note: note ?? '',
        place: { id, name, lat, lon, categoryId, tags: {} },
      })),
    };
  } catch {
    return null;
  }
}

// ---------- Route ----------

export function planRouteUrl(stops: PlanStop[]): string {
  const pts = stops.map((s) => `${s.place.lat},${s.place.lon}`);
  if (pts.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${pts[0]}&travelmode=walking`;
  const params = new URLSearchParams({
    api: '1',
    origin: pts[0],
    destination: pts[pts.length - 1],
    travelmode: 'walking',
  });
  if (pts.length > 2) params.set('waypoints', pts.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

export function planDistance(stops: PlanStop[]): number {
  let sum = 0;
  for (let i = 1; i < stops.length; i++) sum += distance(stops[i - 1].place, stops[i].place);
  return sum;
}

// ---------- Kalender (.ics) ----------

const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Ein Termin pro Stopp. Ohne Uhrzeit: ab 18:00 im 90-Minuten-Takt. */
export function planToIcs(plan: Plan): string {
  const day = plan.date || new Date().toISOString().slice(0, 10);
  const [y, mo, d] = day.split('-').map(Number);
  let fallback = new Date(y, mo - 1, d, 18, 0);

  const starts = plan.stops.map((s) => {
    if (s.time) {
      const [h, m] = s.time.split(':').map(Number);
      fallback = new Date(y, mo - 1, d, h, m);
    }
    const start = new Date(fallback);
    fallback = new Date(fallback.getTime() + 90 * 60000);
    return start;
  });

  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const events = plan.stops.map((s, i) => {
    const start = starts[i];
    const next = starts[i + 1];
    const end = next && next > start ? next : new Date(start.getTime() + 90 * 60000);
    const cat = categoryOf(s.place.categoryId);
    const desc = [s.note, osmUrl(s.place)].filter(Boolean).join('\n');
    return [
      'BEGIN:VEVENT',
      `UID:${s.uid}-${day}@date-planer`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(`${cat.emoji} ${s.place.name}`)}`,
      `LOCATION:${icsEscape(addressText(s.place.tags) ?? s.place.name)}`,
      `GEO:${s.place.lat};${s.place.lon}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Date Planer//DE', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
