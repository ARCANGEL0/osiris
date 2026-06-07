import { NextResponse } from 'next/server';
import { getShodanKey } from '@/lib/shodanKeys';

export const dynamic = 'force-dynamic';

/**
 * Shodan IOT lookup — uses rotating OSS plan keys for enriched host data,
 * falls back to InternetDB (free, no key) for basic port/CVE info.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get('ip');

  if (!ip) return NextResponse.json({ error: 'Missing IP parameter' }, { status: 400 });

  // Try full Shodan API with rotating key first (gives more data)
  const key = getShodanKey();
  if (key) {
    try {
      const res = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${key}`, {
        signal: AbortSignal.timeout(8000), cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, source: 'shodan-api' });
      }
    } catch { /* fall through to InternetDB */ }
  }

  // Fallback: InternetDB (always free, no key)
  try {
    const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (res.status === 404) {
      return NextResponse.json({ ip, status: 'No records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [], source: 'internetdb' });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ...data, source: 'internetdb' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Shodan lookup failed', detail: error.message }, { status: 502 });
  }
}
