import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — RIPE Atlas Internet Measurement Nodes
 * 14,300+ active probes worldwide with real coordinates — free, no auth.
 * Each probe is a physical internet-connected device running measurements.
 * Shows global internet infrastructure distribution in real-time.
 */

let _cache: { probes: any[]; ts: number } | null = null;

async function fetchProbesPage(url: string): Promise<{ results: any[]; next: string | null }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'OSIRIS-OSINT/4.2 (open source intelligence platform)',
    },
  });
  if (!res.ok) throw new Error(`RIPE Atlas ${res.status}`);
  const data = await res.json();
  return { results: data.results || [], next: data.next || null };
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < 3600000) { // 1h cache
    return NextResponse.json(
      { probes: _cache.probes, total: _cache.probes.length, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  }

  const probes: any[] = [];
  const BASE = 'https://atlas.ripe.net/api/v2/probes/?status=1&fields=id,geometry,country_code,description,asn_v4,is_anchor&page_size=500&format=json';

  // Fetch first 10 pages in parallel (5,000 probes) — full dataset is 14k+
  const pages = await Promise.allSettled(
    Array.from({ length: 14 }, (_, i) =>
      fetchProbesPage(`${BASE}&page=${i + 1}`)
    )
  );

  const seen = new Set<number>();
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const probe of page.value.results) {
      if (!probe.geometry?.coordinates || seen.has(probe.id)) continue;
      seen.add(probe.id);
      const [lng, lat] = probe.geometry.coordinates;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;
      probes.push({
        id: `ripe-${probe.id}`,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        country: probe.country_code,
        asn: probe.asn_v4,
        description: probe.description || `Probe #${probe.id}`,
        is_anchor: probe.is_anchor || false,
        probe_id: probe.id,
      });
    }
  }

  _cache = { probes, ts: now };

  return NextResponse.json(
    { probes, total: probes.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
  );
}
