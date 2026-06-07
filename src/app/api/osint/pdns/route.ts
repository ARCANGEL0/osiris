import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  if (!query) return NextResponse.json({ error: 'Missing query parameter (domain or IP)' }, { status: 400 });

  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(query);
  const results: any[] = [];
  const sources: string[] = [];

  // Source 1: CIRCL PDNS (NDJSON)
  try {
    const res = await fetch(`https://www.circl.lu/pdns/query/${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const rec = JSON.parse(line);
          results.push({
            source: 'CIRCL',
            rrtype: rec.rrtype,
            rrname: rec.rrname,
            rdata: rec.rdata,
            time_first: rec.time_first,
            time_last: rec.time_last,
            count: rec.count,
          });
        } catch { /* skip malformed line */ }
      }
      if (lines.length) sources.push('CIRCL');
    }
  } catch { /* silent */ }

  // Source 2: RIPEstat DNS hostname list (IPs only)
  if (isIP) {
    try {
      const res = await fetch(
        `https://stat.ripe.net/data/dns-hostname-list/data.json?resource=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const hostnames: string[] = data?.data?.hostnames || [];
        for (const h of hostnames) {
          results.push({ source: 'RIPEstat', rrtype: 'PTR', rrname: query, rdata: h });
        }
        if (hostnames.length) sources.push('RIPEstat');
      }
    } catch { /* silent */ }
  }

  // Source 3: HackerTarget hostsearch (domains only)
  if (!isIP) {
    try {
      const res = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = await res.text();
        if (!text.includes('error') && !text.includes('API count exceeded')) {
          const lines = text.trim().split('\n').filter(Boolean);
          for (const line of lines) {
            const [host, ip] = line.split(',');
            if (host && ip) {
              results.push({ source: 'HackerTarget', rrtype: 'A', rrname: host.trim(), rdata: ip.trim() });
            }
          }
          if (lines.length) sources.push('HackerTarget');
        }
      }
    } catch { /* silent */ }
  }

  // Sort by time_last descending (CIRCL records)
  results.sort((a, b) => (b.time_last || 0) - (a.time_last || 0));

  return NextResponse.json({ query, results, total: results.length, sources, timestamp: new Date().toISOString() });
}
