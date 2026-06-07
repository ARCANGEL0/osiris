import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  try {
    const [availRes, cdxRes] = await Promise.allSettled([
      fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(8000),
      }),
      fetch(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=10&fl=timestamp,statuscode,mimetype&from=20200101`,
        { signal: AbortSignal.timeout(8000) }
      ),
    ]);

    const result: any = { url, timestamp: new Date().toISOString() };

    if (availRes.status === 'fulfilled' && availRes.value.ok) {
      const avail = await availRes.value.json();
      const snap = avail?.archived_snapshots?.closest;
      result.available = !!snap?.available;
      result.closest = snap || null;
    } else {
      result.available = false;
      result.closest = null;
    }

    if (cdxRes.status === 'fulfilled' && cdxRes.value.ok) {
      const cdx = await cdxRes.value.json();
      // CDX returns array of arrays; first row is header
      const [header, ...rows] = Array.isArray(cdx) ? cdx : [[], []];
      result.snapshots = rows.map((row: string[]) => {
        const obj: Record<string, string> = {};
        (header as string[]).forEach((key: string, i: number) => { obj[key] = row[i]; });
        return obj;
      });
    } else {
      result.snapshots = [];
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Wayback lookup failed' }, { status: 500 });
  }
}
