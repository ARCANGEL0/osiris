import { NextResponse } from 'next/server';

/**
 * OSIRIS — Global Flight Tracking
 *
 * Source hierarchy (tried in order, results merged):
 *  1. OpenSky Network   — free, no key, global (~10k aircraft), plain fetch required
 *  2. adsb.lol          — free, no key, regional, plain fetch required
 *  3. Wingbits          — military/special interest flights (WINGBITS_API_KEY env)
 *
 * IMPORTANT: stealthFetch BREAKS these APIs. All sources use plain fetch.
 */

const PLAIN_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/4.2)',
};

// ── Regional query points for adsb.lol fallback ──
const REGIONS = [
  { lat: 39.8, lon: -98.5, dist: 2500 },  // North America
  { lat: 50.0, lon: 15.0,  dist: 2500 },  // Europe
  { lat: 35.0, lon: 105.0, dist: 2500 },  // Asia
  { lat: -25.0, lon: 133.0, dist: 2500 }, // Australia/Oceania
  { lat: 0.0,  lon: 20.0,  dist: 3000 },  // Africa
  { lat: -15.0, lon: -60.0, dist: 2500 }, // South America
];

// ── Extended military callsign patterns (from GodsEye + community research) ──
const MILITARY_CALLSIGN_RE = /^(RCH|REACH|JAKE|DARK|STING|GHOST|VIPER|HOOK|IRON|SWORD|VALOR|SPAR|EXEC|MAGIC|TITAN|FURY|HAWK|EAGLE|FALCON|RAVEN|WOLF|KING|DUKE|EVAC|CONVOY|BOXER|BISON|ASCOT|TARTAN|RESCUE|RANGER|COBRA|CODY|KNIGHT|TALON|SPARTAN|SHIELD|SAMSON|RHINO|ROMAN|RANGER|SAM\d|SAVE\d|ANGEL\d|DEMON|NINJA|OLIVE|JOKER|PARROT|TUNA|GARNET|SHADOW|STEEL|WARRIOR|ZOMBIE|RELAY|JEDI|TORCH|MARSHAL|GIANT|BUCK|BRONCO)/i;

// ── ICAO hex ranges known to be military/government ──
const MIL_RANGES: Array<[number, number]> = [
  [0xAE0000, 0xAFFFFF], // US DoD (Air Force, Navy, Army, USMC)
  [0x43C000, 0x43FFFF], // UK RAF / Royal Navy
  [0x380000, 0x381FFF], // French military
  [0x3D0000, 0x3D7FFF], // German Bundeswehr
  [0x478000, 0x47FFFF], // Netherlands military
  [0x4B4000, 0x4B7FFF], // Belgium military
  [0x6B8000, 0x6BFFFF], // Israel military
  [0x700000, 0x700FFF], // Iranian Air Force
  [0xC20000, 0xC3FFFF], // Canadian DND
  [0x7C4000, 0x7C4FFF], // Australian RAAF
];

function isIcaoMilitary(hex: string): boolean {
  if (!hex) return false;
  const h = parseInt(hex, 16);
  return MIL_RANGES.some(([lo, hi]) => h >= lo && h <= hi);
}

// ── Emergency squawk codes ──
const SPECIAL_SQUAWKS: Record<string, string> = {
  '7500': 'HIJACK',
  '7600': 'COMMS FAILURE',
  '7700': 'EMERGENCY',
};

// ── Aircraft type sets ──
const HELI_TYPES = new Set(['R22','R44','R66','B06','B407','B412','B429','EC35','EC45','EC75','H125','H130','H135','H145','S70','S76','S92','AW09','AH64','CH47','UH60','AH1Z','MV22']);
const PRIVATE_JET_TYPES = new Set(['G150','G200','G280','G500','G550','G600','G650','G700','GLEX','GLF5','GLF6','GL7T','CL30','CL35','CL60','BD10','C25A','C25B','C510','C525','C550','C560','C680','C700','C750','E35L','E50P','E55P','FA7X','FA8X','F900','LJ35','LJ40','LJ45','LJ60','LJ70','PC12','PC24','TBM9','SF50','PRM1']);
const MILITARY_TYPES = new Set(['C17','C5M','C130','KC46','KC35','E3CF','E8A','B1B','B2','B52','F16','F15','F18','F22','F35','A10','RC135','E6B','P8A','MQ9','RQ4','U2','EP3','V22','EUFI','A400','C295','TU95','TU22','TU160','IL76','IL78','J20','Y20','KJ500']);
const AIRLINE_IATA_RE = /^[A-Z]{3}\d/;

// ── Normalization helpers ──

function classifyFlight(icao24: string, callsign: string, model: string, dbFlags: number, squawk: string): 'commercial' | 'private' | 'jet' | 'military' {
  const cs = (callsign || '').trim().toUpperCase();
  const m = (model || '').toUpperCase();
  if (
    (dbFlags & 1) ||
    MILITARY_TYPES.has(m) ||
    isIcaoMilitary(icao24) ||
    MILITARY_CALLSIGN_RE.test(cs)
  ) return 'military';
  if (PRIVATE_JET_TYPES.has(m)) return 'jet';
  const airlineMatch = AIRLINE_IATA_RE.exec(cs);
  if (!airlineMatch && m && !['A319','A320','A321','A332','A333','A339','A343','A359','A388','B737','B738','B739','B38M','B39M','B752','B763','B772','B77W','B788','B789','B78X','E170','E175','E190','E195','CRJ7','CRJ9','AT43','AT72','DH8D'].includes(m)) return 'private';
  return 'commercial';
}

function normalizeAdsbLol(ac: any): any | null {
  if (ac.lat == null || ac.lon == null) return null;
  const callsign = (ac.flight || ac.hex || '').trim();
  const altFt = ac.alt_baro ?? ac.alt_geom ?? 0;
  const altM = typeof altFt === 'number' ? Math.round(altFt * 0.3048) : 0;
  const category = classifyFlight(ac.hex || '', callsign, ac.t || '', ac.dbFlags || 0, ac.squawk || '');
  const specialSquawk = SPECIAL_SQUAWKS[ac.squawk || ''];
  return {
    callsign, lat: Math.round(ac.lat * 100000) / 100000, lng: Math.round(ac.lon * 100000) / 100000,
    alt: altM, heading: Math.round(ac.track || 0), speed_knots: ac.gs ? Math.round(ac.gs) : null,
    model: ac.t || '', icao24: (ac.hex || '').toLowerCase(), registration: ac.r || '',
    squawk: ac.squawk || '', special_squawk: specialSquawk || null,
    aircraft_category: HELI_TYPES.has((ac.t || '').toUpperCase()) ? 'heli' : 'plane',
    category, source: 'adsb.lol',
  };
}

function normalizeOpenSky(st: any[]): any | null {
  const lon = st[5]; const lat = st[6];
  if (lat == null || lon == null) return null;
  const icao24 = (st[0] || '').trim().toLowerCase();
  const callsign = (st[1] || icao24).trim().toUpperCase();
  const altM = st[13] ?? st[7] ?? 0;
  const squawk = (st[14] || '').toString();
  const category = classifyFlight(icao24, callsign, '', 0, squawk);
  const specialSquawk = SPECIAL_SQUAWKS[squawk];
  return {
    callsign, lat: Math.round(lat * 100000) / 100000, lng: Math.round(lon * 100000) / 100000,
    alt: altM ? Math.round(altM) : 0, heading: Math.round(st[10] || 0),
    speed_knots: st[9] ? Math.round(st[9] * 1.944) : null,
    model: '', icao24, registration: '', squawk,
    special_squawk: specialSquawk || null,
    aircraft_category: 'plane', category, source: 'opensky',
  };
}

// ── Fetchers ──

async function fetchOpenSkyGlobal(): Promise<any[]> {
  const creds = process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET
    ? Buffer.from(`${process.env.OPENSKY_CLIENT_ID}:${process.env.OPENSKY_CLIENT_SECRET}`).toString('base64')
    : null;
  const headers: Record<string, string> = { ...PLAIN_HEADERS };
  if (creds) headers['Authorization'] = `Basic ${creds}`;

  const res = await fetch('https://opensky-network.org/api/states/all', {
    headers, signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  if (res.status === 429) throw Object.assign(new Error('OpenSky rate limited'), { code: 429 });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
  const data = await res.json();
  return (data.states || [])
    .map(normalizeOpenSky)
    .filter((a: any) => a !== null && !( a.alt < 30 )); // skip ground traffic
}

async function fetchAdsbLolRegion(region: typeof REGIONS[0]): Promise<any[]> {
  const res = await fetch(
    `https://api.adsb.lol/v2/lat/${region.lat}/lon/${region.lon}/dist/${region.dist}`,
    { headers: PLAIN_HEADERS, signal: AbortSignal.timeout(12000), cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.ac || []).map(normalizeAdsbLol).filter(Boolean);
}

async function fetchWingbits(): Promise<any[]> {
  const key = process.env.WINGBITS_API_KEY;
  if (!key) return [];
  const res = await fetch('https://customer-api.wingbits.com/v1/flights', {
    headers: { ...PLAIN_HEADERS, 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.flights || data || []).map((f: any) => ({
    callsign: (f.callsign || f.flight || '').trim(),
    lat: f.lat, lng: f.lon || f.lng,
    alt: f.altitude || f.alt || 0,
    heading: f.heading || f.track || 0,
    speed_knots: f.speed || f.gs || null,
    model: f.aircraft_type || f.type || '',
    icao24: (f.icao24 || f.hex || '').toLowerCase(),
    registration: f.registration || '',
    squawk: f.squawk || '',
    category: 'military',
    aircraft_category: 'plane',
    source: 'wingbits',
  })).filter((f: any) => f.lat != null && f.lng != null);
}

// ── Cache (per-isolate, 45s TTL) ──
let _cache: any = null;
let _cacheTime = 0;
let _fetchPromise: Promise<any> | null = null;
const CACHE_TTL = 45000;

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return NextResponse.json(_cache, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  }
  if (_fetchPromise) {
    try { return NextResponse.json(await _fetchPromise, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }); }
    catch { return NextResponse.json({ error: 'Fetch failed' }, { status: 500 }); }
  }

  _fetchPromise = (async () => {
    const seenHex = new Set<string>();
    const commercial: any[] = [], privateFl: any[] = [], jets: any[] = [], military: any[] = [];
    const gpsJamming: any[] = [];
    let source = 'none';

    // 1. Try OpenSky global (single request, best coverage)
    try {
      const osAircraft = await fetchOpenSkyGlobal();
      source = 'opensky';
      for (const ac of osAircraft) {
        if (!ac?.icao24 || seenHex.has(ac.icao24)) continue;
        seenHex.add(ac.icao24);
        switch (ac.category) {
          case 'military': military.push(ac); break;
          case 'jet': jets.push(ac); break;
          case 'private': privateFl.push(ac); break;
          default: commercial.push(ac);
        }
      }
    } catch (e) {
      console.warn('[OSIRIS] OpenSky failed, trying adsb.lol:', (e as Error).message);
    }

    // 2. Supplement/fallback with adsb.lol (better for special aircraft + regional detail)
    try {
      const regionResults = await Promise.allSettled(REGIONS.map(r => fetchAdsbLolRegion(r)));
      let lolCount = 0;
      for (const result of regionResults) {
        if (result.status !== 'fulfilled') continue;
        for (const ac of result.value) {
          if (!ac?.icao24 || seenHex.has(ac.icao24)) continue;
          seenHex.add(ac.icao24);
          lolCount++;
          // GPS jamming detection
          if (typeof ac.nac_p === 'number' && ac.nac_p <= 4 && ac.alt > 100) {
            gpsJamming.push({ lat: ac.lat, lng: ac.lng, nac_p: ac.nac_p, callsign: ac.callsign });
          }
          switch (ac.category) {
            case 'military': military.push(ac); break;
            case 'jet': jets.push(ac); break;
            case 'private': privateFl.push(ac); break;
            default: commercial.push(ac);
          }
        }
      }
      if (lolCount > 0) source = source === 'opensky' ? 'opensky+adsb.lol' : 'adsb.lol';
    } catch (e) {
      console.warn('[OSIRIS] adsb.lol failed:', (e as Error).message);
    }

    // 3. Wingbits military supplement (if key set)
    try {
      const wb = await fetchWingbits();
      for (const ac of wb) {
        if (!ac.icao24 || seenHex.has(ac.icao24)) continue;
        seenHex.add(ac.icao24);
        military.push(ac);
      }
      if (wb.length > 0) source += '+wingbits';
    } catch { /* silent */ }

    // Aggregate GPS jamming zones
    const jammingZones: any[] = [];
    const gridMap = new Map<string, { lat: number; lng: number; count: number; severity: number }>();
    for (const j of gpsJamming) {
      const key = `${Math.round(j.lat)},${Math.round(j.lng)}`;
      const existing = gridMap.get(key);
      if (existing) { existing.count++; existing.severity = Math.max(existing.severity, 10 - j.nac_p); }
      else gridMap.set(key, { lat: j.lat, lng: j.lng, count: 1, severity: 10 - j.nac_p });
    }
    for (const z of gridMap.values()) if (z.count >= 2) jammingZones.push(z);

    const result = {
      commercial_flights: commercial,
      private_flights: privateFl,
      private_jets: jets,
      military_flights: military,
      gps_jamming: jammingZones,
      source,
      total: commercial.length + privateFl.length + jets.length + military.length,
      timestamp: new Date().toISOString(),
    };

    _cache = result;
    _cacheTime = Date.now();
    _fetchPromise = null;
    return result;
  })();

  try {
    const data = await _fetchPromise;
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (e) {
    _fetchPromise = null;
    console.error('[OSIRIS] Flight fetch error:', e);
    return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 });
  }
}
