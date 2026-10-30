export type GroupId = 'food' | 'nature' | 'culture' | 'active' | 'wellness';

export type CriterionId =
  | 'dog'
  | 'vegetarian'
  | 'vegan'
  | 'water'
  | 'wheelchair'
  | 'outdoor'
  | 'free'
  | 'open';

/** Ergebnis einer Kriterien-Prüfung: bestätigt, widerlegt, keine Angabe, oder passt nicht zur Kategorie. */
export type Tri = 'yes' | 'no' | 'unknown' | 'na';

export interface LatLon {
  lat: number;
  lon: number;
}

export type OsmTags = Record<string, string>;

/** Was gesucht wird – gilt für jede Datenquelle (Geoapify, Overpass, Demo). */
export interface SearchParams {
  center: LatLon;
  radius: number;
  categoryIds: string[];
}

/** Ein Ort aus OpenStreetMap, so wie die App ihn benutzt. */
export interface Place extends LatLon {
  /** z. B. "node/123456" – eindeutig in OSM */
  id: string;
  name: string;
  categoryId: string;
  tags: OsmTags;
  /** liegt ≤ 120 m an See/Fluss/Küste (nur bekannt, wenn das Wasser-Kriterium aktiv ist) */
  nearWater?: boolean;
}

export interface PlanStop {
  uid: string;
  place: Place;
  time: string; // "HH:MM" oder ""
  note: string;
}

export interface Plan {
  title: string;
  date: string; // "YYYY-MM-DD" oder ""
  stops: PlanStop[];
}

export interface SavedPlan extends Plan {
  id: string;
  savedAt: string;
}
