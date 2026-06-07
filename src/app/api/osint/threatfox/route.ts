import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const ioc = searchParams.get('ioc')?.trim();

  if (!ioc) {
    return NextResponse.json(
      { error: 'Missing ?ioc= parameter. Accepts: IP, domain, URL, MD5/SHA256 hash.' },
      { status: 400 }
    );
  }

  // Basic sanity checks
  if (ioc.length > 512) {
    return NextResponse.json({ error: 'IOC value too long (max 512 chars)' }, { status: 400 });
  }

  // Determine query type
  const isMd5 = /^[a-fA-F0-9]{32}$/.test(ioc);
  const isSha256 = /^[a-fA-F0-9]{64}$/.test(ioc);
  const isHash = isMd5 || isSha256;

  try {
    // Always search via search_ioc first
    const iocBody = JSON.stringify({ query: 'search_ioc', search_term: ioc });
    const iocRes = await fetch(THREATFOX_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'API-KEY': '0' },
      body: iocBody,
      signal: AbortSignal.timeout(10_000),
    });

    if (!iocRes.ok) {
      return NextResponse.json(
        { error: `ThreatFox API error: ${iocRes.status}` },
        { status: 502 }
      );
    }

    const iocData = await iocRes.json();

    let hashData: any = null;
    // If it's a hash, also run search_hash for richer results
    if (isHash) {
      try {
        const hashRes = await fetch(THREATFOX_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'API-KEY': '0' },
          body: JSON.stringify({ query: 'search_hash', hash: ioc }),
          signal: AbortSignal.timeout(8_000),
        });
        if (hashRes.ok) {
          hashData = await hashRes.json();
        }
      } catch { /* non-critical */ }
    }

    // Normalise the IOC results
    const rawResults: any[] = iocData?.data ?? [];
    const results = rawResults.map((entry: any) => ({
      ioc_id: entry.id ?? entry.ioc_id,
      ioc: entry.ioc,
      ioc_type: entry.ioc_type,
      threat_type: entry.threat_type,
      threat_type_desc: entry.threat_type_desc,
      malware: entry.malware,
      malware_alias: entry.malware_alias,
      malware_printable: entry.malware_printable,
      first_seen: entry.first_seen,
      last_seen: entry.last_seen,
      confidence_level: entry.confidence_level,
      reporter: entry.reporter,
      reference: entry.reference,
      tags: entry.tags ?? [],
    }));

    // Normalise hash results if present
    let hashResults: any[] = [];
    if (hashData?.data && Array.isArray(hashData.data)) {
      hashResults = hashData.data.map((entry: any) => ({
        sha256_hash: entry.sha256_hash,
        md5_hash: entry.md5_hash,
        file_name: entry.file_name,
        file_type: entry.file_type,
        file_size: entry.file_size,
        signature: entry.signature,
        tags: entry.tags ?? [],
        first_seen: entry.first_seen,
        last_seen: entry.last_seen,
        reporter: entry.reporter,
        intelligence: entry.intelligence,
      }));
    }

    return NextResponse.json({
      ioc,
      query_status: iocData.query_status ?? 'ok',
      result_count: results.length,
      results,
      hash_details: hashResults.length > 0 ? hashResults : undefined,
      timestamp: new Date().toISOString(),
      source: 'abuse.ch ThreatFox',
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json({ error: 'ThreatFox API timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to query ThreatFox' }, { status: 500 });
  }
}
