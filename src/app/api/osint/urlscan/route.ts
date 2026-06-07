import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'Missing q parameter (e.g. domain:example.com)' }, { status: 400 });

  try {
    const res = await fetch(
      `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(q)}&size=10`,
      {
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `URLScan returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      uuid: r.task?.uuid,
      url: r.task?.url,
      time: r.task?.time,
      visibility: r.task?.visibility,
      screenshot: r.screenshot,
      domain: r.page?.domain,
      ip: r.page?.ip,
      country: r.page?.country,
      server: r.page?.server,
      mime_type: r.page?.mimeType,
      malicious: r.verdicts?.overall?.malicious,
      tags: r.verdicts?.overall?.tags,
    }));
    return NextResponse.json({ results, total: data.total, query: q });
  } catch {
    return NextResponse.json({ error: 'URLScan lookup failed' }, { status: 500 });
  }
}
