/**
 * Fiktive Beispiel-Orte rund um Berlin-Mitte für den Demo-Modus (`?demo` in der URL).
 * Zum Entwickeln/Testen, wenn die öffentlichen Overpass-Server nicht antworten.
 * Namen sind erfunden – keine echten Läden.
 */
export const DEMO_ELEMENTS = [
  { type: 'node', id: 1, lat: 52.5191, lon: 13.4009, tags: { amenity: 'restaurant', name: 'Trattoria Beispiel', cuisine: 'italian;pizza', 'diet:vegetarian': 'yes', dog: 'yes', outdoor_seating: 'yes', opening_hours: 'Mo-Su 12:00-23:00', 'addr:street': 'Musterufer', 'addr:housenumber': '3', 'addr:postcode': '10178', 'addr:city': 'Berlin', website: 'https://example.com', phone: '+49 30 1234567' } },
  { type: 'node', id: 2, lat: 52.5232, lon: 13.4121, tags: { amenity: 'restaurant', name: 'Grüne Gabel', cuisine: 'vegan', 'diet:vegan': 'only', 'diet:vegetarian': 'only', wheelchair: 'yes', opening_hours: 'Tu-Sa 17:00-22:30', 'addr:street': 'Beispielstraße', 'addr:housenumber': '12', 'addr:postcode': '10178', 'addr:city': 'Berlin' } },
  { type: 'node', id: 3, lat: 52.5168, lon: 13.4102, tags: { amenity: 'restaurant', name: 'Zum Probierstück', cuisine: 'german;regional', dog: 'no', opening_hours: 'Mo-Fr 11:30-22:00' } },
  { type: 'node', id: 4, lat: 52.5203, lon: 13.3978, tags: { amenity: 'cafe', name: 'Café Muster', dog: 'yes', outdoor_seating: 'yes', 'diet:vegan': 'yes', opening_hours: 'Mo-Fr 08:00-18:00; Sa,Su 09:00-18:00', 'contact:instagram': 'cafe_muster_demo' } },
  { type: 'node', id: 5, lat: 52.5247, lon: 13.4035, tags: { amenity: 'cafe', name: 'Kaffeerösterei Testlauf', wheelchair: 'limited', opening_hours: 'Mo-Sa 09:00-19:00' } },
  { type: 'node', id: 6, lat: 52.5255, lon: 13.4089, tags: { amenity: 'bar', name: 'Bar Platzhalter', opening_hours: 'We-Sa 19:00-02:00', outdoor_seating: 'no' } },
  { type: 'node', id: 7, lat: 52.5183, lon: 13.4061, tags: { amenity: 'biergarten', name: 'Biergarten am Ufer', dog: 'yes', outdoor_seating: 'yes', opening_hours: 'Apr-Sep Mo-Su 12:00-23:00' } },
  { type: 'node', id: 8, lat: 52.5219, lon: 13.4072, tags: { amenity: 'ice_cream', name: 'Eis-Labor Demo', 'diet:vegan': 'yes', opening_hours: 'Mo-Su 11:00-21:00' } },
  { type: 'way', id: 9, center: { lat: 52.5262, lon: 13.3991 }, tags: { leisure: 'park', name: 'Demo-Park', dog: 'leashed' } },
  { type: 'node', id: 10, lat: 52.5208, lon: 13.4094, tags: { tourism: 'viewpoint' } },
  { type: 'node', id: 11, lat: 52.5161, lon: 13.3995, tags: { leisure: 'bathing_place', name: 'Badestelle Musterufer', dog: 'no' } },
  { type: 'node', id: 12, lat: 52.5199, lon: 13.3962, tags: { tourism: 'museum', name: 'Museum für Beispiele', fee: 'yes', wheelchair: 'yes', opening_hours: 'Tu-Su 10:00-18:00', description: 'Fiktives Museum für den Demo-Modus.' } },
  { type: 'node', id: 13, lat: 52.5241, lon: 13.4148, tags: { amenity: 'cinema', name: 'Lichtspiele Demo', wheelchair: 'yes' } },
  { type: 'node', id: 14, lat: 52.5176, lon: 13.4031, tags: { amenity: 'boat_rental', name: 'Bootsverleih Demo', opening_hours: 'Apr-Oct Mo-Su 10:00-19:00', dog: 'yes' } },
  { type: 'node', id: 15, lat: 52.5271, lon: 13.4058, tags: { leisure: 'miniature_golf', name: 'Minigolf Demo', fee: 'yes' } },
  { type: 'node', id: 16, lat: 52.5226, lon: 13.4161, tags: { leisure: 'escape_game', name: 'Escape Room Rätselbox', opening_hours: 'Mo-Su 12:00-22:00' } },
  { type: 'node', id: 17, lat: 52.5214, lon: 13.4003, tags: { tourism: 'gallery', name: 'Galerie Probe', fee: 'no' } },
  { type: 'node', id: 18, lat: 52.5157, lon: 13.4079, tags: { amenity: 'theatre', name: 'Theater Demo' } },
  { type: 'way', id: 19, center: { lat: 52.5172, lon: 13.3958 }, tags: { leisure: 'garden', name: 'Rosengarten Demo', fee: 'no' } },
  { type: 'node', id: 20, lat: 52.5284, lon: 13.4012, tags: { tourism: 'picnic_site' } },
  { type: 'node', id: 21, lat: 52.5187, lon: 13.3986, tags: { amenity: 'restaurant', name: 'Sushi Beispiel', cuisine: 'sushi', outdoor_seating: 'yes', opening_hours: 'Mo-Su 12:00-22:00' } },
  // Ausgabe von ".near out ids": diese Orte liegen am Wasser
  { type: 'node', id: 1 },
  { type: 'node', id: 4 },
  { type: 'node', id: 7 },
  { type: 'node', id: 21 },
  { type: 'way', id: 19 },
] as const;
