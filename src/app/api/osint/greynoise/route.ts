import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, parseIPv4 } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

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
    const res = await fetch(`https://api.greynoise.io/v3/community/${canonical}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });

    if (res.status === 404) {
      return NextResponse.json({ ip: canonical, noise: false, riot: false, classification: 'unknown', message: 'IP not observed by GreyNoise' });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `GreyNoise returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'GreyNoise lookup failed' }, { status: 500 });
  }
}
