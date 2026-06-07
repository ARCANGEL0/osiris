import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Military Satellite Tracker
 *
 * Source priority:
 * 1. Space-Track.org (USSTRATCOM 18th Space Control Squadron) — official US military catalog
 *    Requires env: SPACE_TRACK_USER + SPACE_TRACK_PASSWORD (free at space-track.org)
 * 2. CelesTrak active TLE catalog — public mirror, no auth, filter by military name patterns
 *
 * Positions computed with simplified SGP4 (same as /api/satellites).
 * Cache: 5 minutes (satellites move fast).
 */

// ── Military satellite name patterns ──
const MILITARY_PATTERNS = [
  // USA
  /^USA[-\s]/i, /^NROL[-\s]/i, /^WGS[-\s]/i, /^MUOS[-\s]/i,
  /^SBIRS[-\s]/i, /^AEHF[-\s]/i, /^MILSTAR/i, /^DSP[-\s]/i,
  /^GPS\s(IIF|IIR|III|IIIF)/i, /^NAVSTAR/i, /^ADVANCED\s(ORION|KH)/i,
  /^MENTOR/i, /^TRUMPET/i, /^ORION\s\d/i, /^LACROSSE/i,
  /^MISTY/i, /^ONYX/i, /^IMPROVED CRYSTAL/i,
  /^NOSS/i, /^SDS[-\s]/i, /^DSCS/i,
  // Russia
  /^COSMOS[-\s]\d{4}/i, /^MOLNIYA/i, /^MERIDIAN/i,
  /^PERSONA/i, /^BARS-M/i, /^GONETS[-\s]/i,
  /^TUNDRA/i, /^EKS[-\s]/i, /^GLONASS/i,
  // China
  /^YAOGAN[-\s]/i, /^JIAN BING/i, /^TIANLIAN/i,
  /^LUDI TANCE WEIXING/i, /^ZIYUAN/i,
  // Other
  /^OFEQ/i,  // Israel
  /^RISAT/i, /^CARTOSAT/i,  // India
];

function isMilitary(name: string): boolean {
  return MILITARY_PATTERNS.some(re => re.test(name));
}

// Nation from satellite name
function inferNation(name: string): string {
  const n = name.toUpperCase();
  if (/^(USA|WGS|MUOS|SBIRS|AEHF|MILSTAR|DSP|GPS|NAVSTAR|LACROSSE|NOSS|TRUMPET|MENTOR|ORION|ONYX|MISTY|NROL|SDS|DSCS|ADVANCED)/.test(n)) return 'US';
  if (/^(COSMOS|MOLNIYA|MERIDIAN|PERSONA|BARS|GONETS|TUNDRA|EKS|GLONASS)/.test(n)) return 'Russia';
  if (/^(YAOGAN|JIAN BING|TIANLIAN|LUDI|ZIYUAN)/.test(n)) return 'China';
  if (/^OFEQ/.test(n)) return 'Israel';
  if (/^(RISAT|CARTOSAT)/.test(n)) return 'India';
  return 'Unknown';
}

function missionType(name: string): string {
  const n = name.toUpperCase();
  if (/GPS|NAVSTAR|GLONASS|BEIDOU/.test(n)) return 'Navigation';
  if (/SBIRS|DSP|EKS|TUNDRA/.test(n)) return 'Missile Early Warning';
  if (/AEHF|MILSTAR|WGS|DSCS|MERIDIAN|GONETS/.test(n)) return 'Military Comms';
  if (/MUOS/.test(n)) return 'Mobile User Comms';
  if (/LACROSSE|ONYX|YAOGAN|PERSONA|BARS|RISAT|CARTOSAT|OFEQ|IMPROVED CRYSTAL|ADVANCED KH/.test(n)) return 'Imaging/Recon';
  if (/MENTOR|TRUMPET|ORION|NOSS|ADVANCED ORION/.test(n)) return 'SIGINT';
  if (/MISTY/.test(n)) return 'Classified Stealth';
  return 'Military';
}

// ── SGP4 simple propagator (same as /api/satellites) ──
function gmst(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0;
  const s = 67310.54841 + (876600.0 * 3600 + 8640184.812866) * t + 0.093104 * t * t - 6.2e-6 * t * t * t;
  return ((s % 86400) / 86400.0) * 2 * Math.PI;
}

function propagate(line1: string, line2: string): { lat: number; lng: number; alt: number } | null {
  try {
    const incDeg = parseFloat(line2.substring(8, 16));
    const raanDeg = parseFloat(line2.substring(17, 25));
    const ecc = parseFloat('0.' + line2.substring(26, 33).trim());
    const argPerDeg = parseFloat(line2.substring(34, 42));
    const meanAnomDeg = parseFloat(line2.substring(43, 51));
    const meanMotion = parseFloat(line2.substring(52, 63));
    if (isNaN(meanMotion) || meanMotion === 0) return null;
    const epochYear = parseInt(line1.substring(18, 20));
    const epochDay = parseFloat(line1.substring(20, 32));
    const fullYear = epochYear > 56 ? 1900 + epochYear : 2000 + epochYear;
    const epochDate = new Date(fullYear, 0, 1);
    epochDate.setDate(epochDate.getDate() + epochDay - 1);
    const elapsedMin = (Date.now() - epochDate.getTime()) / 60000;
    if (Math.abs(elapsedMin) > 43200) return null;
    const n = meanMotion * 2 * Math.PI / 1440;
    let E = ((meanAnomDeg * Math.PI / 180) + n * elapsedMin) % (2 * Math.PI);
    for (let j = 0; j < 10; j++) E = ((meanAnomDeg * Math.PI / 180) + n * elapsedMin) % (2 * Math.PI) + ecc * Math.sin(E);
    const sinV = Math.sqrt(1 - ecc * ecc) * Math.sin(E) / (1 - ecc * Math.cos(E));
    const cosV = (Math.cos(E) - ecc) / (1 - ecc * Math.cos(E));
    const v = Math.atan2(sinV, cosV);
    const a = Math.pow(398600.4418 / (meanMotion * 2 * Math.PI / 86400) ** 2, 1 / 3);
    const r = a * (1 - ecc * Math.cos(E));
    const inc = incDeg * Math.PI / 180;
    const raan = raanDeg * Math.PI / 180;
    const u = v + argPerDeg * Math.PI / 180;
    const x = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(inc));
    const y = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(inc));
    const z = r * Math.sin(u) * Math.sin(inc);
    const theta = gmst(2440587.5 + Date.now() / 86400000);
    const xR = x * Math.cos(theta) + y * Math.sin(theta);
    const yR = -x * Math.sin(theta) + y * Math.cos(theta);
    const lat = Math.atan2(z, Math.sqrt(xR * xR + yR * yR)) * 180 / Math.PI;
    const lng = Math.atan2(yR, xR) * 180 / Math.PI;
    const alt = r - 6371;
    if (isNaN(lat) || Math.abs(lat) > 90 || alt < 100 || alt > 50000) return null;
    return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(((lng + 540) % 360 - 180) * 10000) / 10000, alt: Math.round(alt) };
  } catch { return null; }
}

// ── Space-Track.org session ──
async function loginSpaceTrack(user: string, pass: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.space-track.org/ajaxauth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : null;
  } catch { return null; }
}

async function fetchSpaceTrackMilitary(cookie: string): Promise<any[]> {
  // Query active payloads from major military space powers, TLE epoch < 30 days
  const url = 'https://www.space-track.org/basicspacedata/query/class/gp/decay_date/null-val/EPOCH/%3Enow-30/OBJECT_TYPE/PAYLOAD/COUNTRY_CODE/US,RU,CN,IL,IN,FR,GB,KP,IR/orderby/NORAD_CAT_ID/format/json';
  const res = await fetch(url, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Space-Track HTTP ${res.status}`);
  const data: any[] = await res.json();
  return data.filter(d => d.TLE_LINE1 && d.TLE_LINE2 && isMilitary(d.OBJECT_NAME || ''));
}

// ── CelesTrak fallback ──
function parseTleText(text: string): Array<{ name: string; line1: string; line2: string }> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = [];
  for (let i = 0; i + 2 < lines.length; i++) {
    if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
      result.push({ name: lines[i].replace(/^0\s+/, ''), line1: lines[i + 1], line2: lines[i + 2] });
      i += 2;
    }
  }
  return result;
}

async function fetchCelesTrakMilitary(): Promise<any[]> {
  const res = await fetch('https://celestrak.org/pub/TLE/active.txt', {
    signal: AbortSignal.timeout(25000),
    headers: { 'Accept': 'text/plain' },
  });
  if (!res.ok) throw new Error('CelesTrak unavailable');
  const text = await res.text();
  const all = parseTleText(text);
  return all.filter(s => isMilitary(s.name));
}

// Module-level cache
let _milSatCache: { satellites: any[]; ts: number; source: string } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (_milSatCache && now - _milSatCache.ts < 300000) { // 5 min cache
      return NextResponse.json(
        { satellites: _milSatCache.satellites, total: _milSatCache.satellites.length, source: _milSatCache.source, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
      );
    }

    const stUser = process.env.SPACE_TRACK_USER;
    const stPass = process.env.SPACE_TRACK_PASSWORD;
    let rawSats: Array<{ name: string; line1: string; line2: string }> = [];
    let source = 'none';

    if (stUser && stPass) {
      try {
        const cookie = await loginSpaceTrack(stUser, stPass);
        if (cookie) {
          const stData = await fetchSpaceTrackMilitary(cookie);
          rawSats = stData.map(d => ({ name: d.OBJECT_NAME, line1: d.TLE_LINE1, line2: d.TLE_LINE2 }));
          source = 'space-track.org';
        }
      } catch (err) {
        console.warn('[OSIRIS] Space-Track failed:', (err as Error).message);
      }
    }

    if (rawSats.length === 0) {
      try {
        rawSats = await fetchCelesTrakMilitary();
        source = 'celestrak';
      } catch (err) {
        console.warn('[OSIRIS] CelesTrak failed:', (err as Error).message);
      }
    }

    const satellites = [];
    for (const sat of rawSats) {
      const pos = propagate(sat.line1, sat.line2);
      if (!pos) continue;
      const noradId = sat.line1.substring(2, 7).trim();
      satellites.push({
        name: sat.name,
        lat: pos.lat,
        lng: pos.lng,
        alt: pos.alt,
        nation: inferNation(sat.name),
        mission: missionType(sat.name),
        noradId,
        color: inferNation(sat.name) === 'US' ? '#FF3D3D' : inferNation(sat.name) === 'Russia' ? '#FF6B00' : inferNation(sat.name) === 'China' ? '#FFD700' : '#E040FB',
      });
    }

    _milSatCache = { satellites, ts: now, source };

    return NextResponse.json(
      { satellites, total: satellites.length, source, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json({ satellites: [], total: 0, source: 'error' }, { status: 500 });
  }
}
