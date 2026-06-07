import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp, parseIPv4 } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

const FEODO_URL = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';
const SSL_BL_URL = 'https://sslbl.abuse.ch/blacklist/sslipblacklist.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

interface FeodoEntry {
  ip_address: string;
  port: number;
  status: string;
  hostname: string | null;
  as_name: string;
  country: string;
  first_seen_utc: string;
  last_online: string;
}

interface SslEntry {
  DstIP: string;
  DstPort: number;
  Reason: string;
}

interface Cache<T> {
  data: T;
  fetched_at: number;
}

// Module-level cache — persists across requests within a Node.js worker process
let feodoCache: Cache<FeodoEntry[]> | null = null;
let sslCache: Cache<SslEntry[]> | null = null;

async function getFeodoList(): Promise<FeodoEntry[]> {
  const now = Date.now();
  if (feodoCache && now - feodoCache.fetched_at < CACHE_TTL_MS) {
    return feodoCache.data;
  }
  const res = await fetch(FEODO_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Feodo fetch failed: ${res.status}`);
  const json = await res.json();
  const list: FeodoEntry[] = Array.isArray(json) ? json : (json.data ?? []);
  feodoCache = { data: list, fetched_at: now };
  return list;
}

async function getSslList(): Promise<SslEntry[]> {
  const now = Date.now();
  if (sslCache && now - sslCache.fetched_at < CACHE_TTL_MS) {
    return sslCache.data;
  }
  const res = await fetch(SSL_BL_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`SSL BL fetch failed: ${res.status}`);
  const json = await res.json();
  const list: SslEntry[] = Array.isArray(json) ? json : (json.data ?? []);
  sslCache = { data: list, fetched_at: now };
  return list;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const ipRaw = searchParams.get('ip')?.trim();

  if (!ipRaw) {
    return NextResponse.json(
      { error: 'Missing ?ip= parameter (IPv4 only)' },
      { status: 400 }
    );
  }

  const ip = parseIPv4(ipRaw);
  if (!ip) {
    return NextResponse.json(
      { error: 'Invalid or private/reserved IPv4 address' },
      { status: 400 }
    );
  }

  try {
    const [feodoList, sslList] = await Promise.allSettled([getFeodoList(), getSslList()]);

    const feodoData = feodoList.status === 'fulfilled' ? feodoList.value : [];
    const sslData = sslList.status === 'fulfilled' ? sslList.value : [];

    const feodoEntry = feodoData.find(
      (e: FeodoEntry) => e.ip_address === ip
    ) ?? null;

    const sslEntry = sslData.find(
      (e: SslEntry) => e.DstIP === ip
    ) ?? null;

    const isC2 = !!(feodoEntry || sslEntry);

    return NextResponse.json({
      ip,
      is_c2: isC2,
      feodo_entry: feodoEntry
        ? {
            ip_address: feodoEntry.ip_address,
            port: feodoEntry.port,
            status: feodoEntry.status,
            hostname: feodoEntry.hostname,
            as_name: feodoEntry.as_name,
            country: feodoEntry.country,
            first_seen_utc: feodoEntry.first_seen_utc,
            last_online: feodoEntry.last_online,
            source: 'Feodo Tracker (abuse.ch)',
          }
        : null,
      ssl_entry: sslEntry
        ? {
            ip: sslEntry.DstIP,
            port: sslEntry.DstPort,
            reason: sslEntry.Reason,
            source: 'SSL Blacklist (abuse.ch)',
          }
        : null,
      last_updated: feodoCache
        ? new Date(feodoCache.fetched_at).toISOString()
        : null,
      feodo_list_size: feodoData.length,
      ssl_list_size: sslData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Feodo/SSL feed timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to check C2 databases' }, { status: 500 });
  }
}
