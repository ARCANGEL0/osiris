import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, parseIPv4 } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

// Module-level cache of Tor exit node IPs
let torExitSet: Set<string> = new Set();
let torExitLastFetched = 0;
const TOR_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getTorExitNodes(): Promise<Set<string>> {
  const now = Date.now();
  if (torExitSet.size > 0 && now - torExitLastFetched < TOR_CACHE_TTL) {
    return torExitSet;
  }
  try {
    const res = await fetch('https://check.torproject.org/torbulkexitlist', {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const text = await res.text();
      torExitSet = new Set(
        text.split('\n').map(l => l.trim()).filter(l => /^(\d{1,3}\.){3}\d{1,3}$/.test(l))
      );
      torExitLastFetched = now;
    }
  } catch { /* keep existing cache */ }
  return torExitSet;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const ip = searchParams.get('ip');
  if (!ip) return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 });

  const canonical = parseIPv4(ip);
  if (!canonical) return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });

  try {
    const [exitNodes, relayRes] = await Promise.allSettled([
      getTorExitNodes(),
      fetch(`https://onionoo.torproject.org/details?search=${canonical}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'application/json' },
      }),
    ]);

    const nodes = exitNodes.status === 'fulfilled' ? exitNodes.value : new Set<string>();
    const is_tor_exit = nodes.has(canonical);

    let relay_details = null;
    if (relayRes.status === 'fulfilled' && relayRes.value.ok) {
      const data = await relayRes.value.json();
      const relays = data?.relays || [];
      if (relays.length > 0) {
        relay_details = {
          nickname: relays[0].nickname,
          fingerprint: relays[0].fingerprint,
          flags: relays[0].flags,
          country: relays[0].country,
          as: relays[0].as,
          bandwidth_rate: relays[0].bandwidth_rate,
          first_seen: relays[0].first_seen,
          last_seen: relays[0].last_seen,
        };
      }
    }

    return NextResponse.json({
      ip: canonical,
      is_tor_exit,
      is_tor_relay: relay_details !== null,
      relay_details,
      last_updated: new Date(torExitLastFetched || Date.now()).toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Tor lookup failed' }, { status: 500 });
  }
}
