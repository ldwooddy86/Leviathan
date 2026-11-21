/* Where sites think you are. Each place sets the time zone pages see and, when location is set to "pretend",
   the coordinates they get (a city centre, nudged a few hundred metres per site). "Nowhere" is the default:
   UTC, the zone Tor Browser reports, and no coordinates at all.
   tools/build.mjs writes one inject/places/<id>.js file per entry; the background picks the file for the
   chosen place, because a page script must know its settings before the page's own scripts run. */
export const PLACES = [
  { id: 'nowhere', label: 'Nowhere', region: 'none', tz: 'UTC' },

  { id: 'honolulu', label: 'Honolulu', region: 'Americas', tz: 'Pacific/Honolulu', lat: 21.3069, lon: -157.8583 },
  { id: 'anchorage', label: 'Anchorage', region: 'Americas', tz: 'America/Anchorage', lat: 61.2181, lon: -149.9003 },
  { id: 'los-angeles', label: 'Los Angeles', region: 'Americas', tz: 'America/Los_Angeles', lat: 34.0522, lon: -118.2437 },
  { id: 'vancouver', label: 'Vancouver', region: 'Americas', tz: 'America/Vancouver', lat: 49.2827, lon: -123.1207 },
  { id: 'phoenix', label: 'Phoenix', region: 'Americas', tz: 'America/Phoenix', lat: 33.4484, lon: -112.074 },
  { id: 'denver', label: 'Denver', region: 'Americas', tz: 'America/Denver', lat: 39.7392, lon: -104.9903 },
  { id: 'chicago', label: 'Chicago', region: 'Americas', tz: 'America/Chicago', lat: 41.8781, lon: -87.6298 },
  { id: 'dallas', label: 'Dallas', region: 'Americas', tz: 'America/Chicago', lat: 32.7767, lon: -96.797 },
  { id: 'mexico-city', label: 'Mexico City', region: 'Americas', tz: 'America/Mexico_City', lat: 19.4326, lon: -99.1332 },
  { id: 'new-york', label: 'New York', region: 'Americas', tz: 'America/New_York', lat: 40.7128, lon: -74.006 },
  { id: 'toronto', label: 'Toronto', region: 'Americas', tz: 'America/Toronto', lat: 43.6532, lon: -79.3832 },
  { id: 'bogota', label: 'Bogotá', region: 'Americas', tz: 'America/Bogota', lat: 4.711, lon: -74.0721 },
  { id: 'sao-paulo', label: 'São Paulo', region: 'Americas', tz: 'America/Sao_Paulo', lat: -23.5505, lon: -46.6333 },
  { id: 'buenos-aires', label: 'Buenos Aires', region: 'Americas', tz: 'America/Argentina/Buenos_Aires', lat: -34.6037, lon: -58.3816 },

  { id: 'reykjavik', label: 'Reykjavík', region: 'Europe and Africa', tz: 'Atlantic/Reykjavik', lat: 64.1466, lon: -21.9426 },
  { id: 'london', label: 'London', region: 'Europe and Africa', tz: 'Europe/London', lat: 51.5074, lon: -0.1278 },
  { id: 'dublin', label: 'Dublin', region: 'Europe and Africa', tz: 'Europe/Dublin', lat: 53.3498, lon: -6.2603 },
  { id: 'lisbon', label: 'Lisbon', region: 'Europe and Africa', tz: 'Europe/Lisbon', lat: 38.7223, lon: -9.1393 },
  { id: 'madrid', label: 'Madrid', region: 'Europe and Africa', tz: 'Europe/Madrid', lat: 40.4168, lon: -3.7038 },
  { id: 'paris', label: 'Paris', region: 'Europe and Africa', tz: 'Europe/Paris', lat: 48.8566, lon: 2.3522 },
  { id: 'amsterdam', label: 'Amsterdam', region: 'Europe and Africa', tz: 'Europe/Amsterdam', lat: 52.3676, lon: 4.9041 },
  { id: 'berlin', label: 'Berlin', region: 'Europe and Africa', tz: 'Europe/Berlin', lat: 52.52, lon: 13.405 },
  { id: 'zurich', label: 'Zürich', region: 'Europe and Africa', tz: 'Europe/Zurich', lat: 47.3769, lon: 8.5417 },
  { id: 'stockholm', label: 'Stockholm', region: 'Europe and Africa', tz: 'Europe/Stockholm', lat: 59.3293, lon: 18.0686 },
  { id: 'warsaw', label: 'Warsaw', region: 'Europe and Africa', tz: 'Europe/Warsaw', lat: 52.2297, lon: 21.0122 },
  { id: 'athens', label: 'Athens', region: 'Europe and Africa', tz: 'Europe/Athens', lat: 37.9838, lon: 23.7275 },
  { id: 'lagos', label: 'Lagos', region: 'Europe and Africa', tz: 'Africa/Lagos', lat: 6.5244, lon: 3.3792 },
  { id: 'nairobi', label: 'Nairobi', region: 'Europe and Africa', tz: 'Africa/Nairobi', lat: -1.2921, lon: 36.8219 },
  { id: 'johannesburg', label: 'Johannesburg', region: 'Europe and Africa', tz: 'Africa/Johannesburg', lat: -26.2041, lon: 28.0473 },

  { id: 'dubai', label: 'Dubai', region: 'Asia and Pacific', tz: 'Asia/Dubai', lat: 25.2048, lon: 55.2708 },
  { id: 'mumbai', label: 'Mumbai', region: 'Asia and Pacific', tz: 'Asia/Kolkata', lat: 19.076, lon: 72.8777 },
  { id: 'singapore', label: 'Singapore', region: 'Asia and Pacific', tz: 'Asia/Singapore', lat: 1.3521, lon: 103.8198 },
  { id: 'hong-kong', label: 'Hong Kong', region: 'Asia and Pacific', tz: 'Asia/Hong_Kong', lat: 22.3193, lon: 114.1694 },
  { id: 'seoul', label: 'Seoul', region: 'Asia and Pacific', tz: 'Asia/Seoul', lat: 37.5665, lon: 126.978 },
  { id: 'tokyo', label: 'Tokyo', region: 'Asia and Pacific', tz: 'Asia/Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 'sydney', label: 'Sydney', region: 'Asia and Pacific', tz: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 },
  { id: 'auckland', label: 'Auckland', region: 'Asia and Pacific', tz: 'Pacific/Auckland', lat: -36.8485, lon: 174.7633 }
];

export const REGIONS = ['Americas', 'Europe and Africa', 'Asia and Pacific'];

export function placeById(id) {
  return PLACES.find(p => p.id === id) || PLACES[0];
}

/* The data a generated place file hands the page script: only what it needs. */
export function placePayload(p) {
  const o = { id: p.id, tz: p.tz };
  if (typeof p.lat === 'number') { o.lat = p.lat; o.lon = p.lon; }
  return o;
}

/* The place whose time zone matches a real zone, for the welcome page's "a city in my own time zone". */
export function placeForZone(tz) {
  return PLACES.find(p => p.id !== 'nowhere' && p.tz === tz) || null;
}
