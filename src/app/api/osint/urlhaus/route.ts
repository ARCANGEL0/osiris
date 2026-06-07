import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

const URLHAUS_API_URL = 'https://urlhaus-api.abuse.ch/v1/url/';
const URLHAUS_API_HOST = 'https://urlhaus-api.abuse.ch/v1/host/';

const HOSTNAME_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get('url')?.trim();
  const hostParam = searchParams.get('host')?.trim();

  if (!urlParam && !hostParam) {
    return NextResponse.json(
      { error: 'Missing parameter. Use ?url=https://... or ?host=example.com' },
      { status: 400 }
    );
  }

  // ─── URL lookup ───
  if (urlParam) {
    if (!urlParam.startsWith('http://') && !urlParam.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must begin with http:// or https://' },
        { status: 400 }
      );
    }
    if (urlParam.length > 2048) {
      return NextResponse.json({ error: 'URL too long (max 2048 chars)' }, { status: 400 });
    }

    try {
      const body = new URLSearchParams({ url: urlParam });
      const res = await fetch(URLHAUS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return NextResponse.json({ error: `URLhaus API error: ${res.status}` }, { status: 502 });
      }

      const data = await res.json();

      return NextResponse.json({
        lookup_type: 'url',
        query: urlParam,
        query_status: data.query_status,
        id: data.id,
        urlhaus_reference: data.urlhaus_reference,
        url: data.url,
        url_status: data.url_status,
        date_added: data.date_added,
        threat: data.threat,
        reporter: data.reporter,
        blacklists: data.blacklists ?? {},
        tags: data.tags ?? [],
        payloads: (data.payloads ?? []).slice(0, 20).map((p: any) => ({
          filename: p.filename,
          file_type: p.file_type,
          response_md5: p.response_md5,
          response_sha256: p.response_sha256,
          response_size: p.response_size,
          signature: p.signature,
          first_seen: p.firstseen,
          last_seen: p.lastseen,
          urlhaus_download: p.urlhaus_download,
          virustotal: p.virustotal ?? null,
        })),
        timestamp: new Date().toISOString(),
        source: 'abuse.ch URLhaus',
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return NextResponse.json({ error: 'URLhaus API timed out' }, { status: 504 });
      }
      return NextResponse.json({ error: 'Failed to query URLhaus' }, { status: 500 });
    }
  }

  // ─── Host lookup ───
  if (hostParam) {
    if (!HOSTNAME_RE.test(hostParam) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(hostParam)) {
      return NextResponse.json(
        { error: 'Invalid host. Provide a valid domain name or IP address.' },
        { status: 400 }
      );
    }
    if (hostParam.length > 253) {
      return NextResponse.json({ error: 'Hostname too long (max 253 chars)' }, { status: 400 });
    }

    try {
      const body = new URLSearchParams({ host: hostParam });
      const res = await fetch(URLHAUS_API_HOST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return NextResponse.json({ error: `URLhaus API error: ${res.status}` }, { status: 502 });
      }

      const data = await res.json();

      return NextResponse.json({
        lookup_type: 'host',
        query: hostParam,
        query_status: data.query_status,
        urlhaus_reference: data.urlhaus_reference,
        blacklists: data.blacklists ?? {},
        urls: (data.urls ?? []).slice(0, 50).map((u: any) => ({
          id: u.id,
          url_status: u.url_status,
          date_added: u.date_added,
          url: u.url,
          threat: u.threat,
          reporter: u.reporter,
          tags: u.tags ?? [],
          urlhaus_reference: u.urlhaus_reference,
        })),
        url_count: (data.urls ?? []).length,
        timestamp: new Date().toISOString(),
        source: 'abuse.ch URLhaus',
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return NextResponse.json({ error: 'URLhaus API timed out' }, { status: 504 });
      }
      return NextResponse.json({ error: 'Failed to query URLhaus' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unexpected state' }, { status: 500 });
}
