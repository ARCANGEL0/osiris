import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Military Bases
 * Primary:  OpenStreetMap Overpass API — community-verified worldwide military installations
 *           mapped from satellite imagery. Typically 8,000-15,000 named features globally.
 * Fallback: Curated 200-entry dataset for when Overpass is unreachable.
 *
 * Cache: 24h (military installations don't move often)
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Military type → our classification schema
const OSM_TYPE_MAP: Record<string, string> = {
  base: 'army_base',
  airfield: 'air_base',
  naval_base: 'naval_base',
  barracks: 'army_base',
  range: 'range',
  bunker: 'nuclear',
  training_area: 'range',
  checkpoint: 'command',
  ammunition: 'nuclear',
  hazard: 'range',
  obstacle: 'range',
};

// Operator → classification from tags
function inferClassification(tags: Record<string, string>): string {
  const combined = JSON.stringify(tags).toLowerCase();
  if (combined.includes('nato')) return 'NATO';
  if (combined.includes('royal') || combined.includes('raf') || combined.includes('royal navy') || combined.includes('british')) return 'UK';
  if (combined.includes('bundeswehr') || combined.includes('luftwaffe')) return 'Germany';
  if (combined.includes('armée') || combined.includes('marine nationale') || combined.includes('armée de l\'air')) return 'France';
  if (combined.includes('pla') || combined.includes('people\'s liberation') || combined.includes('解放军')) return 'China';
  if (combined.includes('российск') || combined.includes('вмф') || combined.includes('вкс') || combined.includes('russia')) return 'Russia';
  if (combined.includes('irgc') || combined.includes('artesh') || combined.includes('iran')) return 'Iran';
  if (combined.includes('kpa') || combined.includes('north korea') || combined.includes('dprk')) return 'DPRK';
  if (combined.includes('idf') || combined.includes('israel')) return 'Israel';
  if (combined.includes('us ') || combined.includes('u.s.') || combined.includes('usaf') || combined.includes('usmc') || combined.includes('us navy') || combined.includes('us army') || combined.includes('ussf')) return 'US';
  // Country code fallback
  const cc = (tags['country'] || tags['addr:country'] || '').toUpperCase();
  const ccMap: Record<string, string> = {
    US: 'US', RU: 'Russia', CN: 'China', GB: 'UK', FR: 'France',
    DE: 'Germany', IL: 'Israel', IR: 'Iran', KP: 'DPRK', TR: 'Turkey',
    IN: 'India', PK: 'Pakistan', SA: 'Saudi Arabia',
  };
  return ccMap[cc] || 'Other';
}

// Module-level cache
let _cache: { bases: any[]; ts: number } | null = null;

async function fetchOverpassBases(): Promise<any[]> {
  const query = `[out:json][timeout:90];
(
  node["military"~"^(base|airfield|naval_base|barracks|range|training_area|checkpoint|bunker|ammunition)$"]["name"];
  way["military"~"^(base|airfield|naval_base|barracks|range|training_area)$"]["name"];
  relation["military"~"^(base|airfield|naval_base)$"]["name"];
);
out center tags;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();

  const bases: any[] = [];
  const seen = new Set<string>();

  for (const el of (data.elements || [])) {
    let lat: number, lng: number;
    if (el.type === 'node') {
      lat = el.lat; lng = el.lon;
    } else if (el.center) {
      lat = el.center.lat; lng = el.center.lon;
    } else continue;

    if (!lat || !lng || !el.tags?.name) continue;
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tags = el.tags as Record<string, string>;
    const milType = tags.military || 'base';

    bases.push({
      id: `osm-${el.type}-${el.id}`,
      name: tags.name,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      country: tags['addr:country'] || tags.country || '',
      operator: tags.operator || tags['operated_by'] || '',
      type: OSM_TYPE_MAP[milType] || 'army_base',
      classification: inferClassification(tags),
      source: 'OpenStreetMap',
      osm_type: milType,
      website: tags.website || tags.url || '',
      notes: tags.description || tags.note || '',
    });
  }

  return bases;
}

// Curated fallback — used when Overpass is down
const FALLBACK_BASES = [
  { id: 'pentagon', name: 'The Pentagon', lat: 38.8712, lng: -77.0561, country: 'United States', operator: 'US DoD', type: 'command', classification: 'US', notes: 'US Department of Defense headquarters.' },
  { id: 'nsa-ft-meade', name: 'NSA / Fort Meade', lat: 39.1084, lng: -76.7717, country: 'United States', operator: 'NSA / USCYBERCOM', type: 'sigint', classification: 'US', notes: 'National Security Agency HQ + US Cyber Command.' },
  { id: 'cia-langley', name: 'CIA Langley', lat: 38.9529, lng: -77.1465, country: 'United States', operator: 'CIA', type: 'intelligence', classification: 'US', notes: 'CIA George Bush Center for Intelligence.' },
  { id: 'norad', name: 'NORAD / Cheyenne Mountain', lat: 38.7444, lng: -104.8462, country: 'United States', operator: 'NORAD', type: 'command', classification: 'US', notes: 'Nuclear-hardened aerospace warning and missile defense command.' },
  { id: 'schriever', name: 'Schriever SFB', lat: 38.8022, lng: -104.5427, country: 'United States', operator: 'US Space Force', type: 'space', classification: 'US', notes: 'Controls GPS and military satellite constellations.' },
  { id: 'ft-liberty', name: 'Fort Liberty (Bragg)', lat: 35.1393, lng: -79.0061, country: 'United States', operator: 'XVIII Airborne Corps', type: 'army_base', classification: 'US', notes: 'Largest US base; 82nd Airborne, JSOC, USASOC.' },
  { id: 'area-51', name: 'Area 51 / Groom Lake', lat: 37.2350, lng: -115.8111, country: 'United States', operator: 'USAF / CIA', type: 'air_base', classification: 'US', notes: 'Classified test and development facility.' },
  { id: 'creech', name: 'Creech AFB', lat: 36.5872, lng: -115.6733, country: 'United States', operator: 'USAF 432nd Wing', type: 'drone', classification: 'US', notes: 'Primary drone warfare hub; MQ-9 Reaper operations globally.' },
  { id: 'minot', name: 'Minot AFB', lat: 48.4191, lng: -101.3578, country: 'United States', operator: 'USAF', type: 'nuclear', classification: 'US', notes: 'B-52H bombers + Minuteman III ICBMs.' },
  { id: 'pine-gap', name: 'Pine Gap', lat: -23.7958, lng: 133.7369, country: 'Australia', operator: 'CIA / NSA', type: 'sigint', classification: 'Five Eyes', notes: 'Joint CIA/NSA satellite ground station; ECHELON node.' },
  { id: 'gchq', name: 'GCHQ Cheltenham', lat: 51.8957, lng: -2.0779, country: 'United Kingdom', operator: 'GCHQ', type: 'sigint', classification: 'UK', notes: 'UK signals intelligence HQ; Five Eyes partner.' },
  { id: 'gchq-bude', name: 'GCHQ Bude (TEMPORA)', lat: 50.8259, lng: -4.5427, country: 'United Kingdom', operator: 'GCHQ / NSA', type: 'sigint', classification: 'UK', notes: 'Undersea cable tapping facility; TEMPORA program.' },
  { id: 'menwith-hill', name: 'Menwith Hill', lat: 54.0022, lng: -1.6936, country: 'United Kingdom', operator: 'NSA / GCHQ', type: 'sigint', classification: 'Five Eyes', notes: 'Largest NSA signals intelligence collection base outside US.' },
  { id: 'khmeimim', name: 'Khmeimim AB, Syria', lat: 35.4013, lng: 35.9480, country: 'Syria', operator: 'Russian VKS', type: 'air_base', classification: 'Russia', notes: 'Primary Russian military air base in the Middle East.' },
  { id: 'tartus', name: 'Tartus Naval Base', lat: 34.8886, lng: 35.8866, country: 'Syria', operator: 'Russian Navy', type: 'naval_base', classification: 'Russia', notes: 'Russia\'s only Mediterranean naval base.' },
  { id: 'severomorsk', name: 'Severomorsk (Northern Fleet)', lat: 69.0694, lng: 33.4347, country: 'Russia', operator: 'Russian Navy', type: 'naval_base', classification: 'Russia', notes: 'HQ of Russia\'s Northern Fleet (nuclear submarines).' },
  { id: 'djibouti-cn', name: 'China PLA Base, Djibouti', lat: 11.5251, lng: 43.0498, country: 'Djibouti', operator: 'PLA Navy', type: 'naval_base', classification: 'China', notes: 'China\'s first overseas military base; logistics and counter-piracy.' },
  { id: 'sanya', name: 'Sanya Naval Base', lat: 18.2200, lng: 109.5742, country: 'China', operator: 'PLA South Sea Fleet', type: 'naval_base', classification: 'China', notes: 'Major PLA Navy submarine base, Hainan Island.' },
  { id: 'fiery-cross', name: 'Fiery Cross Reef', lat: 9.5541, lng: 114.2203, country: 'South China Sea', operator: 'PLA', type: 'air_base', classification: 'China', notes: 'Artificial island military base with 3km runway; contested by multiple nations.' },
  { id: 'mischief-reef', name: 'Mischief Reef', lat: 9.9070, lng: 115.5341, country: 'South China Sea', operator: 'PLA', type: 'naval_base', classification: 'China', notes: 'Artificial island with port facilities; ~430km from Philippine coast.' },
  { id: 'al-udeid', name: 'Al Udeid AB', lat: 25.1172, lng: 51.3147, country: 'Qatar', operator: 'USAF / USCENTCOM', type: 'air_base', classification: 'US', notes: 'Largest US air base in Middle East; CENTCOM forward HQ.' },
  { id: 'incirlik', name: 'Incirlik AFB', lat: 37.0021, lng: 35.4261, country: 'Turkey', operator: 'USAF / NATO', type: 'air_base', classification: 'NATO', notes: 'NATO nuclear sharing base; B61 nuclear bombs stored here.' },
  { id: 'ramstein', name: 'Ramstein AFB', lat: 49.4369, lng: 7.6003, country: 'Germany', operator: 'USAF / NATO', type: 'air_base', classification: 'NATO', notes: 'Largest US air base overseas; NATO Air Command HQ.' },
  { id: 'camp-lemonnier', name: 'Camp Lemonnier', lat: 11.5462, lng: 43.0507, country: 'Djibouti', operator: 'US AFRICOM', type: 'army_base', classification: 'US', notes: 'Only permanent US military base in Africa; drone operations hub.' },
  { id: 'kadena', name: 'Kadena AB', lat: 26.3548, lng: 127.7692, country: 'Japan', operator: 'USAF 18th Wing', type: 'air_base', classification: 'US', notes: 'Largest US Air Force base in Asia.' },
  { id: 'camp-humphreys', name: 'Camp Humphreys', lat: 37.0833, lng: 127.0333, country: 'South Korea', operator: 'US Army / USFK', type: 'army_base', classification: 'US', notes: 'Largest US overseas base; USFK HQ.' },
  { id: 'faslane', name: 'HMNB Clyde (Faslane)', lat: 56.0718, lng: -4.8152, country: 'United Kingdom', operator: 'Royal Navy', type: 'naval_base', classification: 'UK', notes: 'UK\'s only nuclear submarine base; home of Trident SSBN.' },
  { id: 'dimona', name: 'Dimona Nuclear Research Center', lat: 30.9936, lng: 35.1511, country: 'Israel', operator: 'IAEC', type: 'nuclear', classification: 'Israel', notes: 'Alleged Israeli nuclear weapons production facility; officially unconfirmed.' },
  { id: 'fordow', name: 'Fordow Fuel Enrichment Plant', lat: 34.8851, lng: 49.2266, country: 'Iran', operator: 'AEOI / IRGC', type: 'nuclear', classification: 'Iran', notes: 'Buried uranium enrichment facility; hardened against airstrikes.' },
  { id: 'pyongsan', name: 'Pyongsan Uranium Mine', lat: 38.8492, lng: 126.4237, country: 'North Korea', operator: 'DPRK', type: 'nuclear', classification: 'DPRK', notes: 'Primary uranium ore processing site for DPRK nuclear program.' },
  { id: 'sohae', name: 'Sohae Launch Facility', lat: 39.6603, lng: 124.7065, country: 'North Korea', operator: 'DPRK NADA', type: 'space', classification: 'DPRK', notes: 'Primary DPRK space launch and ballistic missile test facility.' },
  { id: 'unit-8200', name: 'Unit 8200 HQ (Glilot)', lat: 32.1239, lng: 34.8325, country: 'Israel', operator: 'IDF / Mossad', type: 'sigint', classification: 'Israel', notes: 'Israel\'s elite signals intelligence unit; equivalent of NSA.' },
];

export async function GET() {
  try {
    const now = Date.now();

    // Return module-level cache if fresh (24h)
    if (_cache && now - _cache.ts < 86400000) {
      return NextResponse.json(
        { bases: _cache.bases, total: _cache.bases.length, source: 'cache', timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
      );
    }

    let bases: any[] = [];
    let source = 'fallback';

    try {
      bases = await fetchOverpassBases();
      if (bases.length > 100) {
        source = 'openstreetmap-overpass';
        _cache = { bases, ts: now };
      } else {
        throw new Error('Too few results from Overpass');
      }
    } catch (err) {
      console.warn('[OSIRIS] Overpass military bases failed, using fallback:', (err as Error).message);
      bases = FALLBACK_BASES;
      source = 'fallback-curated';
    }

    return NextResponse.json(
      { bases, total: bases.length, source, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch {
    return NextResponse.json({ bases: FALLBACK_BASES, total: FALLBACK_BASES.length, source: 'error-fallback' }, { status: 200 });
  }
}
