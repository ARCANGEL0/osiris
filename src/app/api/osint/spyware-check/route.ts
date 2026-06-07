import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────
// Static spyware infrastructure database
// Sources: Citizen Lab, Amnesty International, Microsoft MSTIC,
//          Google TAG, ESET, Lookout published reports
// ─────────────────────────────────────────────────────────────────

interface SpywareEntry {
  pattern: RegExp;
  spyware_name: string;
  operator: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

// Domain / IP pattern matching rules
const SPYWARE_PATTERNS: SpywareEntry[] = [
  // ─── NSO Group / Pegasus (Citizen Lab fingerprints) ───
  { pattern: /\.pgsn\./i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  { pattern: /trackloc\.net$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2016' },
  { pattern: /techno-bay\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  { pattern: /techno-color\.net$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  { pattern: /mobilecollect\.net$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  { pattern: /trackingapis\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  { pattern: /akamai-technologies\.net$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021' },
  { pattern: /cloudfront-technology\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'medium', source: 'Amnesty Tech 2021' },
  { pattern: /fastly-analytics\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'medium', source: 'Amnesty Tech 2021' },
  { pattern: /amazon-business-analytics\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'medium', source: 'Amnesty Tech 2021' },
  { pattern: /free-ssl-certs\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'medium', source: 'Citizen Lab 2019' },
  { pattern: /websiteanalytics-cdn\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'medium', source: 'Citizen Lab 2019' },
  // Pegasus network infrastructure ranges (AWS/DO/Linode ranges are too broad; use specific FPs from reports)
  { pattern: /saleapple\.com$/i, spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021 (MVP endpoint)' },
  { pattern: /linodeobjects\.com$/i, spyware_name: 'Pegasus (possible)', operator: 'NSO Group (suspected)', confidence: 'low', source: 'Amnesty Tech 2021' },

  // ─── Candiru / Saito Tech (Microsoft MSTIC July 2021) ───
  { pattern: /nicetry\.live$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /the-scientist\.online$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /militaryconference\.org$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /peacezone\.org$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /salam-news\.net$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /iransports\.org$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  { pattern: /bvpn\.online$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Citizen Lab / MSTIC 2021' },
  { pattern: /palest-news\.org$/i, spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Citizen Lab 2021' },

  // ─── Predator / Intellexa (Citizen Lab 2021-2023) ───
  { pattern: /datacloud\.live$/i, spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'high', source: 'Citizen Lab 2021' },
  { pattern: /analyticschecker\.net$/i, spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'high', source: 'Citizen Lab 2023' },
  { pattern: /mobiles-check\.com$/i, spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'high', source: 'Citizen Lab 2021' },
  { pattern: /cloudflare-analytics\.live$/i, spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'medium', source: 'Citizen Lab 2023' },
  { pattern: /newlogic-tech\.com$/i, spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'high', source: 'Citizen Lab 2023' },
  { pattern: /static-cdn\.net$/i, spyware_name: 'Predator (possible)', operator: 'Intellexa/Cytrox (suspected)', confidence: 'low', source: 'Citizen Lab 2023' },

  // ─── FinFisher / FinSpy (Citizen Lab, CCC) ───
  { pattern: /finfisher\.com$/i, spyware_name: 'FinFisher/FinSpy', operator: 'Gamma Group', confidence: 'high', source: 'Citizen Lab / CCC 2014' },
  { pattern: /finsupport\.com$/i, spyware_name: 'FinFisher/FinSpy', operator: 'Gamma Group', confidence: 'high', source: 'Citizen Lab 2014' },
  { pattern: /finfly\.net$/i, spyware_name: 'FinFisher/FinSpy', operator: 'Gamma Group', confidence: 'high', source: 'Citizen Lab 2014' },
  { pattern: /mw-download\.com$/i, spyware_name: 'FinFisher/FinSpy', operator: 'Gamma Group', confidence: 'medium', source: 'Citizen Lab 2014' },

  // ─── Hacking Team / RCS Lab (leaked data + Citizen Lab) ───
  { pattern: /hackingteam\.com$/i, spyware_name: 'Remote Control System (RCS)', operator: 'Hacking Team', confidence: 'high', source: 'WikiLeaks HT leak 2015' },
  { pattern: /hackingteam\.it$/i, spyware_name: 'Remote Control System (RCS)', operator: 'Hacking Team', confidence: 'high', source: 'WikiLeaks HT leak 2015' },
  { pattern: /rcsgroup\.it$/i, spyware_name: 'Remote Control System (RCS)', operator: 'Hacking Team', confidence: 'high', source: 'WikiLeaks HT leak 2015' },

  // ─── DSIRF / Subzero (Microsoft MSTIC 2022) ───
  { pattern: /dsirf\.eu$/i, spyware_name: 'Subzero', operator: 'DSIRF GmbH', confidence: 'high', source: 'Microsoft MSTIC 2022' },
  { pattern: /dsinternals\.com$/i, spyware_name: 'Subzero', operator: 'DSIRF GmbH', confidence: 'medium', source: 'Microsoft MSTIC 2022' },

  // ─── RCS Lab / Hermit (Lookout/Google TAG 2022) ───
  { pattern: /rcslab\.it$/i, spyware_name: 'Hermit', operator: 'RCS Lab', confidence: 'high', source: 'Lookout/Google TAG 2022' },

  // ─── QuaDream / Reign ───
  { pattern: /quadream\.com$/i, spyware_name: 'Reign (ENDOFDAYS)', operator: 'QuaDream', confidence: 'high', source: 'Citizen Lab 2023' },

  // ─── NSO Group known infrastructure IPs from Amnesty report ───
  // (A representative selection of IPs published in Amnesty Tech 2021 "Forensic Methodology Report")
];

// Known static IP addresses of spyware infrastructure
// Source: Amnesty International 2021 "Forensic Methodology Report", Citizen Lab published IOCs
const KNOWN_SPYWARE_IPS: Record<string, { spyware_name: string; operator: string; confidence: string; source: string }> = {
  // Amnesty Tech Pegasus IPs (published 2021)
  '104.200.67.189': { spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021' },
  '192.227.158.20':  { spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021' },
  '199.249.230.157': { spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021' },
  '199.249.230.152': { spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Amnesty Tech 2021' },
  // Citizen Lab Pegasus IPs (published 2018 "Hide and Seek" report)
  '198.199.121.201': { spyware_name: 'Pegasus', operator: 'NSO Group', confidence: 'high', source: 'Citizen Lab 2018' },
  // Candiru C2 IPs (Microsoft MSTIC July 2021)
  '80.82.64.127':    { spyware_name: 'DevilsTongue (Candiru)', operator: 'Candiru/Saito Tech', confidence: 'high', source: 'Microsoft MSTIC 2021' },
  // FinFisher C2 IPs (Citizen Lab 2014-2015)
  '209.59.144.155':  { spyware_name: 'FinFisher/FinSpy', operator: 'Gamma Group', confidence: 'high', source: 'Citizen Lab 2014' },
  // Predator IPs (Citizen Lab 2021)
  '185.230.125.36':  { spyware_name: 'Predator', operator: 'Intellexa/Cytrox', confidence: 'high', source: 'Citizen Lab 2021' },
};

const HOSTNAME_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

const CITIZEN_LAB_IOC_URLS = [
  'https://raw.githubusercontent.com/citizenlab/malware-indicators/master/201508_thousand-eyes/domains.txt',
  'https://raw.githubusercontent.com/citizenlab/malware-indicators/master/201602_patchwork/domains.txt',
];

// Module-level cache of CL IOCs
let clIocCache: { domains: Set<string>; fetched_at: number } | null = null;
const CL_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function getCitizenLabDomains(): Promise<Set<string>> {
  const now = Date.now();
  if (clIocCache && now - clIocCache.fetched_at < CL_CACHE_TTL) {
    return clIocCache.domains;
  }
  const domains = new Set<string>();
  for (const url of CITIZEN_LAB_IOC_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'OSIRIS-OSINT/2.0' },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const text = await res.text();
        for (const line of text.split('\n')) {
          const trimmed = line.trim().toLowerCase();
          if (trimmed && !trimmed.startsWith('#') && HOSTNAME_RE.test(trimmed)) {
            domains.add(trimmed);
          }
        }
      }
    } catch { /* skip on error */ }
  }
  clIocCache = { domains, fetched_at: now };
  return domains;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target')?.trim().toLowerCase();

  if (!target) {
    return NextResponse.json(
      { error: 'Missing ?target= parameter (domain or IP address)' },
      { status: 400 }
    );
  }

  if (target.length > 253) {
    return NextResponse.json({ error: 'Target too long' }, { status: 400 });
  }

  const isIp = IPV4_RE.test(target);
  const isDomain = HOSTNAME_RE.test(target);

  if (!isIp && !isDomain) {
    return NextResponse.json(
      { error: 'Invalid target. Provide a valid domain name or IPv4 address.' },
      { status: 400 }
    );
  }

  // ─── IP check ───
  if (isIp) {
    const ipEntry = KNOWN_SPYWARE_IPS[target];
    if (ipEntry) {
      return NextResponse.json({
        target,
        target_type: 'ip',
        matched: true,
        spyware_name: ipEntry.spyware_name,
        operator: ipEntry.operator,
        confidence: ipEntry.confidence,
        source: ipEntry.source,
        notes: 'IP matched against published spyware infrastructure indicators.',
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({
      target,
      target_type: 'ip',
      matched: false,
      spyware_name: null,
      operator: null,
      confidence: 'none',
      source: 'OSIRIS static database',
      notes: 'No match found in known spyware IP database.',
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Domain check ───
  // 1. Pattern-based matching (static rules)
  let patternMatch: SpywareEntry | null = null;
  for (const entry of SPYWARE_PATTERNS) {
    if (entry.pattern.test(target)) {
      patternMatch = entry;
      break;
    }
  }

  if (patternMatch) {
    return NextResponse.json({
      target,
      target_type: 'domain',
      matched: true,
      spyware_name: patternMatch.spyware_name,
      operator: patternMatch.operator,
      confidence: patternMatch.confidence,
      source: patternMatch.source,
      notes: 'Domain matched against known spyware infrastructure patterns.',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Live Citizen Lab GitHub IOC check
  try {
    const clDomains = await getCitizenLabDomains();
    if (clDomains.has(target)) {
      return NextResponse.json({
        target,
        target_type: 'domain',
        matched: true,
        spyware_name: 'Malware (Citizen Lab indicator)',
        operator: 'Unknown',
        confidence: 'medium',
        source: 'Citizen Lab malware-indicators GitHub',
        notes: 'Domain found in Citizen Lab published malware indicator lists.',
        timestamp: new Date().toISOString(),
        cl_ioc_cache_size: clDomains.size,
      });
    }
  } catch { /* non-critical — fall through */ }

  // 3. ThreatFox live query for Pegasus/Predator/FinSpy tagged IOCs
  let threatfoxMatch: any = null;
  try {
    const tfRes = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'API-KEY': '0' },
      body: JSON.stringify({ query: 'search_ioc', search_term: target }),
      signal: AbortSignal.timeout(8_000),
    });
    if (tfRes.ok) {
      const tfData = await tfRes.json();
      const tfResults: any[] = tfData?.data ?? [];
      const spywareTags = ['pegasus', 'predator', 'finspy', 'finfisher', 'candiru', 'hermit', 'reign', 'subzero'];
      for (const entry of tfResults) {
        const tags: string[] = (entry.tags ?? []).map((t: string) => t.toLowerCase());
        const malware: string = (entry.malware ?? '').toLowerCase();
        const malwarePrintable: string = (entry.malware_printable ?? '').toLowerCase();
        const isSpyware = spywareTags.some(s =>
          tags.includes(s) || malware.includes(s) || malwarePrintable.includes(s)
        );
        if (isSpyware) {
          threatfoxMatch = entry;
          break;
        }
      }
    }
  } catch { /* non-critical */ }

  if (threatfoxMatch) {
    return NextResponse.json({
      target,
      target_type: 'domain',
      matched: true,
      spyware_name: threatfoxMatch.malware_printable ?? threatfoxMatch.malware,
      operator: 'Unknown (ThreatFox attributed)',
      confidence: threatfoxMatch.confidence_level > 75 ? 'high' : 'medium',
      source: `abuse.ch ThreatFox (reporter: ${threatfoxMatch.reporter ?? 'anonymous'})`,
      notes: `IOC tagged as spyware in ThreatFox. First seen: ${threatfoxMatch.first_seen}`,
      threatfox_id: threatfoxMatch.id ?? threatfoxMatch.ioc_id,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    target,
    target_type: 'domain',
    matched: false,
    spyware_name: null,
    operator: null,
    confidence: 'none',
    source: 'OSIRIS static + Citizen Lab + ThreatFox',
    notes: 'No spyware infrastructure match found across checked sources.',
    timestamp: new Date().toISOString(),
  });
}
