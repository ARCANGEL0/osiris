import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

const OTX_TYPE_MAP: Record<string, string> = {
  ip: 'IPv4',
  domain: 'domain',
  url: 'URL',
  hash: 'file',
};

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const key = process.env.OTX_API_KEY;
  if (!key) return NextResponse.json({ error: 'OTX_API_KEY not configured', code: 'NO_API_KEY' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const ioc = searchParams.get('ioc');
  const type = searchParams.get('type') || 'ip';
  if (!ioc) return NextResponse.json({ error: 'Missing ioc parameter' }, { status: 400 });

  const otxType = OTX_TYPE_MAP[type] || 'IPv4';
  const headers = { 'X-OTX-API-KEY': key, 'Accept': 'application/json' };
  const base = `https://otx.alienvault.com/api/v1/indicators/${otxType}/${encodeURIComponent(ioc)}`;

  try {
    const [generalRes, reputationRes, malwareRes, urlRes] = await Promise.allSettled([
      fetch(`${base}/general`, { signal: AbortSignal.timeout(8000), headers }),
      fetch(`${base}/reputation`, { signal: AbortSignal.timeout(8000), headers }),
      fetch(`${base}/malware`, { signal: AbortSignal.timeout(8000), headers }),
      fetch(`${base}/url_list`, { signal: AbortSignal.timeout(8000), headers }),
    ]);

    const result: any = { ioc, type, timestamp: new Date().toISOString() };

    if (generalRes.status === 'fulfilled' && generalRes.value.ok) {
      const d = await generalRes.value.json();
      result.pulse_count = d.pulse_info?.count || 0;
      result.tags = d.pulse_info?.tags || [];
      result.industries = d.pulse_info?.industries || [];
      result.references = (d.pulse_info?.references || []).slice(0, 10);
      result.malware_families = d.malware_families || [];
      result.validation = d.validation || [];
    }
    if (reputationRes.status === 'fulfilled' && reputationRes.value.ok) {
      const d = await reputationRes.value.json();
      result.reputation = d.reputation || null;
      result.threat_score = d.threat_score || null;
    }
    if (malwareRes.status === 'fulfilled' && malwareRes.value.ok) {
      const d = await malwareRes.value.json();
      result.malware = (d.data || []).slice(0, 10);
    }
    if (urlRes.status === 'fulfilled' && urlRes.value.ok) {
      const d = await urlRes.value.json();
      result.url_list = (d.url_list || []).slice(0, 10);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'OTX lookup failed' }, { status: 500 });
  }
}
