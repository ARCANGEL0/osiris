import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, parseIPv4 } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const ip = searchParams.get('ip');
  if (!ip) return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 });

  const canonical = parseIPv4(ip);
  if (!canonical) return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });

  const domainSet = new Set<string>();
  const sources: string[] = [];

  // Source 1: HackerTarget reverse IP lookup (free)
  try {
    const res = await fetch(`https://api.hackertarget.com/reverseiplookup/?q=${canonical}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      if (!text.includes('error') && !text.includes('API count exceeded')) {
        text.trim().split('\n').filter(Boolean).forEach(d => domainSet.add(d.trim()));
        sources.push('HackerTarget');
      }
    }
  } catch { /* silent */ }

  // Source 2: RIPEstat DNS hostname list
  try {
    const res = await fetch(
      `https://stat.ripe.net/data/dns-hostname-list/data.json?resource=${canonical}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      const hostnames: string[] = data?.data?.hostnames || [];
      hostnames.forEach(h => domainSet.add(h));
      if (hostnames.length) sources.push('RIPEstat');
    }
  } catch { /* silent */ }

  const domains = Array.from(domainSet).sort();
  return NextResponse.json({
    ip: canonical,
    domains,
    total: domains.length,
    sources,
    timestamp: new Date().toISOString(),
  });
}
