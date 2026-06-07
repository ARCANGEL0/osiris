import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Internet Outages & Disruptions
 * Sources (ALL FREE, NO API KEYS required):
 * 1. IODA (CAIDA) — BGP + Active Probing, free public API
 * 2. BGP.tools — BGP routing anomalies (honest User-Agent required)
 * 3. Cloudflare Radar (optional, env CLOUDFLARE_RADAR_API_KEY)
 */

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [37.09, -95.71], GB: [55.38, -3.44], DE: [51.17, 10.45], FR: [46.23, 2.21],
  CN: [35.86, 104.20], JP: [36.20, 138.25], RU: [61.52, 105.32], BR: [-14.24, -51.93],
  IN: [20.59, 78.96], AU: [-25.27, 133.78], CA: [56.13, -106.35], KR: [35.91, 127.77],
  UA: [48.38, 31.17], SA: [23.89, 45.08], TR: [38.96, 35.24], IR: [32.43, 53.69],
  PK: [30.38, 69.35], NG: [9.08, 8.68], MX: [23.63, -102.55], ID: [-0.79, 113.92],
  EG: [26.82, 30.80], DZ: [28.03, 1.66], LY: [26.34, 17.23], SY: [34.80, 38.99],
  IQ: [33.22, 43.68], YE: [15.55, 48.52], MM: [21.92, 95.96], AF: [33.93, 67.71],
  VN: [14.06, 108.28], TH: [15.87, 100.99], PH: [12.88, 121.77], BD: [23.68, 90.36],
  KE: [-0.02, 37.91], ZA: [-30.56, 22.94], CD: [-4.04, 21.76], SD: [12.86, 30.22],
  BY: [53.71, 27.95], AZ: [40.14, 47.58], GE: [42.32, 43.36], AM: [40.07, 45.04],
  ES: [40.46, -3.75], IT: [41.87, 12.57], PL: [51.92, 19.15], RO: [45.94, 24.97],
  CZ: [49.82, 15.47], HU: [47.16, 19.50], GR: [39.07, 21.82], RS: [44.02, 21.01],
};

let _cache: { outages: any[]; ts: number } | null = null;

async function fetchIODA(): Promise<any[]> {
  const outages: any[] = [];
  // IODA outage alerts endpoint
  try {
    const res = await fetch('https://api.ioda.caida.org/v2/outages?limit=50', {
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'OSIRIS-OSINT/4.2 (github.com/osiris-osint)' },
    });
    if (res.ok) {
      const raw = await res.text();
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : (data?.data || data?.outages || data?.result || []);
      for (const item of items.slice(0, 50)) {
        const cc = item?.entityCode || item?.entity?.code || item?.country;
        const coords = cc ? COUNTRY_CENTROIDS[cc] : null;
        if (!coords) continue;
        outages.push({
          id: `ioda-${item?.id || Math.random()}`,
          location: item?.entityName || item?.entity?.name || cc,
          country: cc, lat: coords[0], lng: coords[1],
          type: item?.datasource?.includes('bgp') ? 'BGP Disruption' : 'Internet Disruption',
          severity: item?.severity || 'medium',
          start_time: item?.startTime || item?.start,
          end_time: item?.endTime || item?.end || null,
          description: `${item?.entityName || cc}: internet disruption detected by CAIDA IODA`,
          source: 'IODA/CAIDA',
        });
      }
    }
  } catch { /* silent */ }
  return outages;
}

async function fetchCloudflareRadar(): Promise<any[]> {
  const key = process.env.CLOUDFLARE_RADAR_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=25', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.result?.annotations || []).map((a: any, i: number) => {
      const cc = a?.locations?.[0];
      const coords = cc ? COUNTRY_CENTROIDS[cc] : null;
      if (!coords) return null;
      return {
        id: `cf-${a?.id || i}`, location: cc, country: cc,
        lat: coords[0], lng: coords[1], type: 'Internet Outage',
        severity: 'high', start_time: a?.startDate, end_time: a?.endDate || null,
        description: a?.description || '', source: 'Cloudflare Radar',
      };
    }).filter(Boolean);
  } catch { return []; }
}

async function fetchBGPAnomalies(): Promise<any[]> {
  try {
    const res = await fetch('https://bgp.tools/table.jsonl', {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'OSIRIS OSINT Platform - henry.arcangello@gmail.com' },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split('\n').filter(Boolean).slice(0, 25);
    return lines.flatMap(line => {
      try {
        const e = JSON.parse(line);
        const coords = e?.country ? COUNTRY_CENTROIDS[e.country] : null;
        if (!coords) return [];
        return [{
          id: `bgp-${e.asn || Math.random()}`,
          location: e.description || `AS${e.asn}`,
          country: e.country, lat: coords[0], lng: coords[1],
          type: 'BGP Anomaly', severity: 'medium',
          start_time: new Date().toISOString(),
          description: `BGP anomaly: AS${e.asn} (${e.description || 'unknown'})`,
          source: 'BGP.tools',
        }];
      } catch { return []; }
    });
  } catch { return []; }
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < 600000) {
    return NextResponse.json(
      { outages: _cache.outages, total: _cache.outages.length, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  }

  const [ioda, cf, bgp] = await Promise.allSettled([fetchIODA(), fetchCloudflareRadar(), fetchBGPAnomalies()]);
  const outages: any[] = [];
  if (ioda.status === 'fulfilled') outages.push(...ioda.value);
  if (cf.status === 'fulfilled') outages.push(...cf.value);
  if (bgp.status === 'fulfilled') outages.push(...bgp.value);

  const seen = new Set<string>();
  const deduped = outages.filter(o => { if (seen.has(o.country)) return false; seen.add(o.country); return true; });

  _cache = { outages: deduped, ts: now };
  return NextResponse.json(
    { outages: deduped, total: deduped.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
