import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Submarine Cables
 * Source 1: TeleGeography cable metadata (names only — no coords in their public API)
 * Source 2: OpenStreetMap Overpass for cable landing stations (has lat/lng)
 * Source 3: Hardcoded global landing point list as fallback
 */

const CABLES_URL = 'https://www.submarinecablemap.com/api/v3/cable/all.json';

let _cache: any = null;
let _cacheTime = 0;

const KNOWN_LANDING_POINTS = [
  // UK / Ireland
  { id: 'cornwall', name: 'Porthcurno / Cornwall', lat: 50.0487, lng: -5.6506, country: 'United Kingdom' },
  { id: 'bude', name: 'Bude, Cornwall', lat: 50.8259, lng: -4.5427, country: 'United Kingdom' },
  { id: 'folkestone', name: 'Folkestone', lat: 51.0779, lng: 1.1749, country: 'United Kingdom' },
  { id: 'southport', name: 'Southport', lat: 53.6444, lng: -3.0047, country: 'United Kingdom' },
  // Western Europe
  { id: 'marseille', name: 'Marseille', lat: 43.2965, lng: 5.3698, country: 'France' },
  { id: 'sopelana', name: 'Sopelana, Basque Country', lat: 43.4000, lng: -2.9667, country: 'Spain' },
  { id: 'altea', name: 'Altea', lat: 38.5993, lng: -0.0487, country: 'Spain' },
  { id: 'mazara', name: 'Mazara del Vallo', lat: 37.6535, lng: 12.5921, country: 'Italy' },
  { id: 'palermo', name: 'Palermo', lat: 38.1157, lng: 13.3615, country: 'Italy' },
  { id: 'catania', name: 'Catania', lat: 37.5023, lng: 15.0873, country: 'Italy' },
  { id: 'lisbon', name: 'Lisbon', lat: 38.7169, lng: -9.1399, country: 'Portugal' },
  { id: 'funchal', name: 'Funchal, Madeira', lat: 32.6669, lng: -16.9241, country: 'Portugal' },
  { id: 'telde', name: 'Telde, Gran Canaria', lat: 27.9919, lng: -15.4086, country: 'Spain' },
  { id: 'baarriere', name: 'Saint-Hilaire-de-Riez', lat: 46.7350, lng: -1.9606, country: 'France' },
  // Scandinavia
  { id: 'kvistgard', name: 'Kvistgård', lat: 56.0000, lng: 12.5000, country: 'Denmark' },
  { id: 'stavanger', name: 'Stavanger', lat: 58.9700, lng: 5.7331, country: 'Norway' },
  // USA East Coast
  { id: 'virginia-beach', name: 'Virginia Beach, VA', lat: 36.8512, lng: -76.0157, country: 'United States' },
  { id: 'long-island', name: 'Long Island, NY', lat: 40.7128, lng: -73.0060, country: 'United States' },
  { id: 'miami-beach', name: 'Miami Beach, FL', lat: 25.7907, lng: -80.1300, country: 'United States' },
  { id: 'jacksonville-beach', name: 'Jacksonville Beach, FL', lat: 30.2928, lng: -81.3916, country: 'United States' },
  // USA West Coast
  { id: 'morro-bay', name: 'Morro Bay, CA', lat: 35.3658, lng: -120.8498, country: 'United States' },
  { id: 'los-angeles', name: 'Los Angeles, CA', lat: 33.9425, lng: -118.4080, country: 'United States' },
  { id: 'grover-beach', name: 'Grover Beach, CA', lat: 35.1219, lng: -120.6174, country: 'United States' },
  { id: 'blaine-wa', name: 'Blaine, WA', lat: 48.9948, lng: -122.7458, country: 'United States' },
  { id: 'pacific-city', name: 'Pacific City, OR', lat: 45.1992, lng: -123.9580, country: 'United States' },
  // Atlantic
  { id: 'fortaleza', name: 'Fortaleza, Brazil', lat: -3.7327, lng: -38.5270, country: 'Brazil' },
  { id: 'rio-de-janeiro', name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729, country: 'Brazil' },
  { id: 'accra', name: 'Accra', lat: 5.5600, lng: -0.2057, country: 'Ghana' },
  { id: 'lagos-ng', name: 'Lagos Cable Station', lat: 6.4351, lng: 3.3956, country: 'Nigeria' },
  // Mediterranean / Middle East
  { id: 'suez', name: 'Suez', lat: 29.9668, lng: 32.5498, country: 'Egypt' },
  { id: 'alexandria', name: 'Alexandria', lat: 31.2001, lng: 29.9187, country: 'Egypt' },
  { id: 'fujairah', name: 'Fujairah', lat: 25.1288, lng: 56.3264, country: 'UAE' },
  { id: 'jeddah', name: 'Jeddah', lat: 21.4858, lng: 39.1925, country: 'Saudi Arabia' },
  { id: 'muscat', name: 'Muscat', lat: 23.6139, lng: 58.5923, country: 'Oman' },
  { id: 'karachi', name: 'Karachi', lat: 24.9056, lng: 66.9900, country: 'Pakistan' },
  // East Africa
  { id: 'djibouti', name: 'Djibouti', lat: 11.5721, lng: 43.1456, country: 'Djibouti' },
  { id: 'mombasa', name: 'Mombasa', lat: -4.0435, lng: 39.6682, country: 'Kenya' },
  { id: 'dar-es-salaam', name: 'Dar es Salaam', lat: -6.7924, lng: 39.2083, country: 'Tanzania' },
  { id: 'durban', name: 'Durban', lat: -29.8587, lng: 31.0218, country: 'South Africa' },
  { id: 'cape-town', name: 'Cape Town', lat: -33.9249, lng: 18.4241, country: 'South Africa' },
  // South Asia
  { id: 'mumbai', name: 'Mumbai (Versova)', lat: 19.1324, lng: 72.8095, country: 'India' },
  { id: 'chennai', name: 'Chennai', lat: 13.0827, lng: 80.2707, country: 'India' },
  { id: 'cochin', name: 'Kochi (Cochin)', lat: 9.9312, lng: 76.2673, country: 'India' },
  { id: 'colombo', name: 'Colombo', lat: 6.9271, lng: 79.8612, country: 'Sri Lanka' },
  // Southeast Asia
  { id: 'singapore-1', name: 'Singapore Changi', lat: 1.3644, lng: 103.9916, country: 'Singapore' },
  { id: 'batam', name: 'Batam, Indonesia', lat: 1.0456, lng: 104.0305, country: 'Indonesia' },
  { id: 'bangkok-th', name: 'Bangkok', lat: 13.7563, lng: 100.5018, country: 'Thailand' },
  { id: 'manila-ph', name: 'Manila', lat: 14.5995, lng: 120.9842, country: 'Philippines' },
  // Asia Pacific
  { id: 'hong-kong', name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'Hong Kong' },
  { id: 'shantou', name: 'Shantou', lat: 23.3542, lng: 116.6882, country: 'China' },
  { id: 'shanghai-cn', name: 'Shanghai', lat: 31.2304, lng: 121.4737, country: 'China' },
  { id: 'taipei', name: 'Toucheng, Taiwan', lat: 24.8653, lng: 121.8302, country: 'Taiwan' },
  { id: 'pusan', name: 'Busan', lat: 35.1796, lng: 129.0756, country: 'South Korea' },
  { id: 'chikura', name: 'Chikura, Japan', lat: 34.9281, lng: 139.9724, country: 'Japan' },
  { id: 'okinawa', name: 'Okinawa', lat: 26.3358, lng: 127.8070, country: 'Japan' },
  { id: 'guam', name: 'Tumon Bay, Guam', lat: 13.4443, lng: 144.7937, country: 'Guam' },
  { id: 'darwin', name: 'Darwin, NT', lat: -12.4634, lng: 130.8456, country: 'Australia' },
  { id: 'perth', name: 'Perth, WA', lat: -31.9505, lng: 115.8605, country: 'Australia' },
  { id: 'sydney', name: 'Brookvale, NSW', lat: -33.7730, lng: 151.2668, country: 'Australia' },
  { id: 'auckland', name: 'Auckland', lat: -36.8485, lng: 174.7633, country: 'New Zealand' },
];

async function fetchOverpassLandingPoints(): Promise<any[]> {
  const query = `[out:json][timeout:30];
(
  node["telecom"="cable_landing_station"]["name"];
  node["communications:submarine_cable"="yes"]["name"];
  node["man_made"="cable_landing_station"]["name"];
);
out body;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/4.2)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements || []).map((el: any) => ({
      id: `osm-${el.id}`, name: el.tags?.name || 'Cable Station',
      lat: el.lat, lng: el.lon,
      country: el.tags?.['addr:country'] || '',
      cables: [],
    })).filter((p: any) => p.lat && p.lng);
  } catch { return []; }
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cacheTime < 86400000) {
    return NextResponse.json(_cache, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  }

  let cables: any[] = [];
  let landing_points: any[] = [...KNOWN_LANDING_POINTS];

  // Fetch cable names from TeleGeography
  try {
    const res = await fetch(CABLES_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/4.2)', 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : Object.values(data);
      cables = (items as any[]).filter((c: any) => c.name);
    }
  } catch { /* use empty */ }

  // Supplement landing points with Overpass (may add more)
  try {
    const osmPoints = await fetchOverpassLandingPoints();
    const knownNames = new Set(landing_points.map(p => p.name.toLowerCase()));
    for (const pt of osmPoints) {
      if (!knownNames.has(pt.name.toLowerCase())) {
        landing_points.push(pt);
        knownNames.add(pt.name.toLowerCase());
      }
    }
  } catch { /* use hardcoded */ }

  const result = {
    cables,
    landing_points,
    total_cables: cables.length,
    total_landing_points: landing_points.length,
    timestamp: new Date().toISOString(),
  };
  _cache = result;
  _cacheTime = now;

  return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
