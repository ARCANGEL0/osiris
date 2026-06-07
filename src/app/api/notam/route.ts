import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — NOTAM / Restricted Airspace
 *
 * Sources:
 * 1. FAA NOTAM API (requires free key: api.faa.gov → env FAA_NOTAM_CLIENT_ID + FAA_NOTAM_CLIENT_SECRET)
 * 2. FAA TFR list scraping (no auth — tfr.faa.gov public endpoint)
 * 3. OpenStreetMap Overpass API for permanent military restricted zones
 *
 * Returns: active TFRs + permanent restricted areas with lat/lng + radius/polygon
 */

interface RestrictedZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_nm?: number;      // nautical miles radius (for circular TFRs)
  alt_floor_ft?: number;
  alt_ceiling_ft?: number;
  type: 'tfr' | 'military' | 'prohibited' | 'restricted' | 'warning';
  effective_start?: string;
  effective_end?: string;
  reason?: string;
  source: string;
}

async function fetchFAANotams(clientId: string, clientSecret: string): Promise<RestrictedZone[]> {
  // OAuth2 client credentials
  const tokenRes = await fetch('https://api.faa.gov/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) throw new Error(`FAA auth ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const res = await fetch('https://api.faa.gov/notamData/api/notams?pageSize=200&pageNum=0', {
    headers: { 'Authorization': `Bearer ${access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`FAA NOTAM API ${res.status}`);
  const data = await res.json();
  const zones: RestrictedZone[] = [];

  for (const n of (data.items || [])) {
    const text = n.notamText || '';
    // Filter for TFRs and military restrictions
    if (!/\b(TFR|TEMPO|MILITARY|RESTRICTED|PROHIBITED|DANGER|AIRSPACE|SUA)\b/i.test(text)) continue;
    const coord = n.geographicCoordinates?.[0] || n.location;
    if (!coord?.latitude || !coord?.longitude) continue;
    zones.push({
      id: `faa-${n.id || n.notamId}`,
      name: n.facilityDesignator || n.icaoLocation || text.substring(0, 50),
      lat: parseFloat(coord.latitude),
      lng: parseFloat(coord.longitude),
      radius_nm: n.radius || undefined,
      alt_floor_ft: n.lowerAltitude || undefined,
      alt_ceiling_ft: n.upperAltitude || undefined,
      type: /TFR/i.test(text) ? 'tfr' : /MILITARY/i.test(text) ? 'military' : 'restricted',
      effective_start: n.startDateTime,
      effective_end: n.endDateTime,
      reason: text.substring(0, 120),
      source: 'FAA API',
    });
  }
  return zones;
}

async function fetchFAATFRScrape(): Promise<RestrictedZone[]> {
  // FAA TFR XML feed — no auth required
  const res = await fetch('https://tfr.faa.gov/tfr2/list.jsp', {
    signal: AbortSignal.timeout(12000),
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/1.0)',
    },
  });
  if (!res.ok) throw new Error(`TFR list ${res.status}`);
  const html = await res.text();
  const zones: RestrictedZone[] = [];

  // Extract TFR entries from HTML — FAA uses a table with TFR IDs
  const tfr_re = /href="detail_(\d+_\d+)\.xml"/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tfr_re.exec(html)) !== null) ids.push(m[1]);

  // Fetch first 20 TFR details in parallel
  const details = await Promise.allSettled(
    ids.slice(0, 20).map(id =>
      fetch(`https://tfr.faa.gov/tfr2/detail_${id}.xml`, { signal: AbortSignal.timeout(8000) })
        .then(r => r.ok ? r.text() : null)
        .catch(() => null)
    )
  );

  for (const d of details) {
    if (d.status !== 'fulfilled' || !d.value) continue;
    const xml = d.value;
    const latMatch = xml.match(/<Lat>([\d.-]+)<\/Lat>/i) || xml.match(/latitude="([\d.-]+)"/i);
    const lngMatch = xml.match(/<Long>([\d.-]+)<\/Long>/i) || xml.match(/longitude="([\d.-]+)"/i);
    const nameMatch = xml.match(/<codeId>([\w-]+)<\/codeId>/i) || xml.match(/<noticeTitle>([^<]+)<\/noticeTitle>/i);
    const radiusMatch = xml.match(/<ValDistVerLower uom="NM">([\d.]+)<\/ValDistVerLower>/i) || xml.match(/<Radius>([\d.]+)<\/Radius>/i);
    const reasonMatch = xml.match(/<txtDescr>([^<]+)<\/txtDescr>/i) || xml.match(/<purpose>([^<]+)<\/purpose>/i);

    if (!latMatch || !lngMatch) continue;
    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lngMatch[1]);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    zones.push({
      id: `tfr-${nameMatch?.[1] || zones.length}`,
      name: nameMatch?.[1] || 'TFR Active',
      lat,
      lng,
      radius_nm: radiusMatch ? parseFloat(radiusMatch[1]) : undefined,
      type: 'tfr',
      reason: reasonMatch?.[1]?.substring(0, 120),
      source: 'FAA TFR',
    });
  }
  return zones;
}

async function fetchOverpassRestricted(): Promise<RestrictedZone[]> {
  // Permanent military restricted airspace from OSM
  const query = `[out:json][timeout:30];
(
  way["aeroway"="restricted_area"]["name"];
  way["military"~"^(danger_area|restricted_area|airfield)$"]["name"];
  relation["aeroway"="restricted_area"]["name"];
);
out center tags;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const zones: RestrictedZone[] = [];
  for (const el of (data.elements || [])) {
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (!lat || !lng || !el.tags?.name) continue;
    zones.push({
      id: `osm-${el.type}-${el.id}`,
      name: el.tags.name,
      lat, lng,
      type: 'military',
      reason: el.tags.description || el.tags.note || 'Military restricted airspace',
      source: 'OpenStreetMap',
    });
  }
  return zones;
}

let _cache: { zones: RestrictedZone[]; ts: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < 600000) { // 10 min cache
    return NextResponse.json(
      { zones: _cache.zones, total: _cache.zones.length, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  }

  const zones: RestrictedZone[] = [];
  const faaClientId = process.env.FAA_NOTAM_CLIENT_ID;
  const faaClientSecret = process.env.FAA_NOTAM_CLIENT_SECRET;

  // Priority order: FAA API → TFR scrape → Overpass
  if (faaClientId && faaClientSecret) {
    try {
      const faaZones = await fetchFAANotams(faaClientId, faaClientSecret);
      zones.push(...faaZones);
    } catch (err) {
      console.warn('[OSIRIS] FAA NOTAM API failed:', (err as Error).message);
    }
  }

  if (zones.length === 0) {
    try {
      const tfrs = await fetchFAATFRScrape();
      zones.push(...tfrs);
    } catch (err) {
      console.warn('[OSIRIS] TFR scrape failed:', (err as Error).message);
    }
  }

  try {
    const permanent = await fetchOverpassRestricted();
    zones.push(...permanent);
  } catch (err) {
    console.warn('[OSIRIS] Overpass restricted zones failed:', (err as Error).message);
  }

  _cache = { zones, ts: now };

  return NextResponse.json(
    { zones, total: zones.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
