import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  // VirusTotal free tier: 4 req/min
  if (isRateLimited(clientIp, 4, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return NextResponse.json({ error: 'VIRUSTOTAL_API_KEY not configured', code: 'NO_API_KEY' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource');
  const type = searchParams.get('type') || 'ip';
  if (!resource) return NextResponse.json({ error: 'Missing resource parameter' }, { status: 400 });

  const VT_BASE = 'https://www.virustotal.com/api/v3';
  const headers = { 'x-apikey': key, 'Accept': 'application/json' };

  const endpointMap: Record<string, string> = {
    ip: `${VT_BASE}/ip_addresses/${encodeURIComponent(resource)}`,
    domain: `${VT_BASE}/domains/${encodeURIComponent(resource)}`,
    url: `${VT_BASE}/urls/${Buffer.from(resource).toString('base64').replace(/=/g, '')}`,
    file: `${VT_BASE}/files/${encodeURIComponent(resource)}`,
  };

  const endpoint = endpointMap[type] || endpointMap['ip'];

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000), headers });
    if (res.status === 404) return NextResponse.json({ error: 'Resource not found in VirusTotal', resource }, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: `VirusTotal returned ${res.status}` }, { status: 502 });

    const data = await res.json();
    const attrs = data?.data?.attributes || {};

    return NextResponse.json({
      resource,
      type,
      id: data?.data?.id,
      last_analysis_stats: attrs.last_analysis_stats,
      last_analysis_date: attrs.last_analysis_date,
      reputation: attrs.reputation,
      total_votes: attrs.total_votes,
      categories: attrs.categories,
      tags: attrs.tags,
      country: attrs.country,
      as_owner: attrs.as_owner,
      network: attrs.network,
      whois: attrs.whois ? attrs.whois.substring(0, 500) : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'VirusTotal lookup failed' }, { status: 500 });
  }
}
