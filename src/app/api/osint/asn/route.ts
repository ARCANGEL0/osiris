import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 15, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource');
  if (!resource) return NextResponse.json({ error: 'Missing resource parameter (AS12345 or 1.2.3.0/24)' }, { status: 400 });

  const isASN = /^(AS)?\d+$/i.test(resource);
  const isPrefix = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(resource);
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(resource);

  if (!isASN && !isPrefix && !isIP) {
    return NextResponse.json({ error: 'Invalid resource format. Use AS12345, IP, or CIDR prefix.' }, { status: 400 });
  }

  const asnNum = isASN ? resource.replace(/^AS/i, '') : null;
  const result: any = { resource, timestamp: new Date().toISOString() };

  try {
    if (asnNum) {
      // BGPView ASN details
      const [asnRes, prefixRes, peersRes, upRes] = await Promise.allSettled([
        fetch(`https://api.bgpview.io/asn/${asnNum}`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.bgpview.io/asn/${asnNum}/prefixes`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.bgpview.io/asn/${asnNum}/peers`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.bgpview.io/asn/${asnNum}/upstreams`, { signal: AbortSignal.timeout(8000) }),
      ]);

      if (asnRes.status === 'fulfilled' && asnRes.value.ok) {
        const d = await asnRes.value.json();
        if (d.status === 'ok') {
          result.asn = d.data.asn;
          result.name = d.data.name;
          result.description = d.data.description_short || d.data.description_full;
          result.country = d.data.country_code;
          result.website = d.data.website;
          result.rir = d.data.rir_allocation?.rir_name;
        }
      }
      if (prefixRes.status === 'fulfilled' && prefixRes.value.ok) {
        const d = await prefixRes.value.json();
        if (d.status === 'ok') {
          result.prefixes = {
            ipv4: (d.data?.ipv4_prefixes || []).slice(0, 30).map((p: any) => ({ prefix: p.prefix, name: p.name, country: p.country_code })),
            ipv6: (d.data?.ipv6_prefixes || []).slice(0, 10).map((p: any) => ({ prefix: p.prefix, name: p.name })),
            total_v4: d.data?.ipv4_prefixes?.length || 0,
            total_v6: d.data?.ipv6_prefixes?.length || 0,
          };
        }
      }
      if (peersRes.status === 'fulfilled' && peersRes.value.ok) {
        const d = await peersRes.value.json();
        if (d.status === 'ok') {
          result.peers = (d.data?.ipv4_peers || []).slice(0, 20).map((p: any) => ({ asn: p.asn, name: p.name, country: p.country_code }));
        }
      }
      if (upRes.status === 'fulfilled' && upRes.value.ok) {
        const d = await upRes.value.json();
        if (d.status === 'ok') {
          result.upstreams = (d.data?.ipv4_upstreams || []).slice(0, 10).map((u: any) => ({ asn: u.asn, name: u.name, country: u.country_code }));
        }
      }

      // RIPEstat announced prefixes
      try {
        const ripeRes = await fetch(
          `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asnNum}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (ripeRes.ok) {
          const d = await ripeRes.json();
          if (d?.data?.prefixes) {
            result.ripe_prefixes_count = d.data.prefixes.length;
          }
        }
      } catch { /* silent */ }

    } else if (isPrefix || isIP) {
      // BGPView prefix lookup
      const endpoint = isIP ? `https://api.bgpview.io/ip/${resource}` : `https://api.bgpview.io/prefix/${resource}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'ok') result.prefix = d.data;
      }

      // RIPEstat routing status
      try {
        const ripeRes = await fetch(
          `https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(resource)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (ripeRes.ok) {
          const d = await ripeRes.json();
          result.routing_stats = d?.data || null;
        }
      } catch { /* silent */ }
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'ASN lookup failed' }, { status: 500 });
  }
}
