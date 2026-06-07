import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

// Sensitive terms that must not appear in sanitised output
const REDACT_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /passwd\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  // Credit card patterns
  /\b(?:\d[ \-]?){13,19}\b/g,
  // SSN patterns
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
];

function sanitize(text: string | undefined | null): string {
  if (!text) return '';
  let out = text;
  for (const pattern of REDACT_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out.slice(0, 500);
}

interface DarkwebResult {
  source: string;
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

interface RansomwarePost {
  group: string;
  victim: string;
  discovered: string;
  website?: string;
  post_url?: string;
  country?: string;
  activity?: string;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 5, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json(
      { error: 'Missing ?query= parameter' },
      { status: 400 }
    );
  }

  if (query.length < 2 || query.length > 200) {
    return NextResponse.json(
      { error: 'Query must be 2-200 characters' },
      { status: 400 }
    );
  }

  const encodedQuery = encodeURIComponent(query);
  const results: DarkwebResult[] = [];
  const ransomwareHits: RansomwarePost[] = [];
  const errors: string[] = [];

  // ─── Source 1: DarkSearch.io ───
  try {
    const darkRes = await fetch(
      `https://darksearch.io/api/search?query=${encodedQuery}&page=1`,
      {
        headers: { 'User-Agent': 'OSIRIS-OSINT/2.0' },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (darkRes.ok) {
      const darkData = await darkRes.json();
      const hits: any[] = darkData?.data ?? [];
      for (const hit of hits.slice(0, 15)) {
        results.push({
          source: 'DarkSearch.io',
          title: sanitize(hit.title),
          url: hit.link ?? '',
          snippet: sanitize(hit.description),
          date: hit.date ?? undefined,
        });
      }
    } else {
      errors.push(`DarkSearch: ${darkRes.status}`);
    }
  } catch {
    errors.push('DarkSearch: timeout/unavailable');
  }

  // ─── Source 2: Ahmia (Tor search engine clearnet) ───
  try {
    const ahmiaRes = await fetch(
      `https://ahmia.fi/search/?q=${encodedQuery}`,
      {
        headers: {
          'User-Agent': 'OSIRIS-OSINT/2.0',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (ahmiaRes.ok) {
      const html = await ahmiaRes.text();
      // Extract results from Ahmia HTML (basic pattern matching on their result structure)
      const resultBlocks = html.match(/<li class="result"[\s\S]*?<\/li>/gi) ?? [];
      for (const block of resultBlocks.slice(0, 10)) {
        const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
        const urlMatch = block.match(/href="(https?:\/\/[^"]+)"/i);
        const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

        if (urlMatch) {
          results.push({
            source: 'Ahmia.fi (Tor index)',
            title: sanitize(titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim()),
            url: urlMatch[1],
            snippet: sanitize(snippetMatch?.[1]?.replace(/<[^>]+>/g, '').trim()),
          });
        }
      }
    } else {
      errors.push(`Ahmia: ${ahmiaRes.status}`);
    }
  } catch {
    errors.push('Ahmia: timeout/unavailable');
  }

  // ─── Source 3: Ransomware.live — recent ransomware group posts ───
  try {
    const ransomRes = await fetch(
      'https://api.ransomware.live/posts',
      {
        headers: { 'User-Agent': 'OSIRIS-OSINT/2.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (ransomRes.ok) {
      const ransomData = await ransomRes.json();
      const posts: any[] = Array.isArray(ransomData) ? ransomData : (ransomData?.posts ?? []);
      const lowerQ = query.toLowerCase();
      for (const post of posts) {
        const victim: string = post.post_title ?? post.victim ?? '';
        const group: string = post.group_name ?? post.group ?? '';
        const country: string = post.country ?? '';
        const activity: string = post.activity ?? '';
        // Match against query
        if (
          victim.toLowerCase().includes(lowerQ) ||
          group.toLowerCase().includes(lowerQ) ||
          country.toLowerCase().includes(lowerQ) ||
          activity.toLowerCase().includes(lowerQ)
        ) {
          ransomwareHits.push({
            group: sanitize(group),
            victim: sanitize(victim),
            discovered: post.discovered ?? post.published ?? post.date ?? '',
            website: post.website ?? undefined,
            post_url: post.post_url ?? undefined,
            country: country || undefined,
            activity: sanitize(activity) || undefined,
          });
        }
        if (ransomwareHits.length >= 20) break;
      }
    } else {
      errors.push(`Ransomware.live: ${ransomRes.status}`);
    }
  } catch {
    errors.push('Ransomware.live: timeout/unavailable');
  }

  // ─── Source 4: IntelX public endpoint (limited, no key) ───
  try {
    const intelxRes = await fetch(
      `https://2.intelx.io:443/intelligent/search?k=&q=${encodedQuery}&t=0&maxresults=5`,
      {
        headers: { 'User-Agent': 'OSIRIS-OSINT/2.0', 'x-key': '' },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (intelxRes.ok) {
      const intelxData = await intelxRes.json();
      const records: any[] = intelxData?.records ?? [];
      for (const r of records.slice(0, 5)) {
        results.push({
          source: 'IntelX (public)',
          title: sanitize(r.name ?? r.title),
          url: r.internalid ? `https://intelx.io/?did=${r.internalid}` : '',
          snippet: sanitize(r.description ?? r.snippet),
          date: r.date ?? undefined,
        });
      }
    }
  } catch {
    // IntelX public endpoint is unreliable; silently skip
  }

  return NextResponse.json({
    query,
    result_count: results.length,
    ransomware_count: ransomwareHits.length,
    results,
    ransomware_hits: ransomwareHits,
    errors: errors.length > 0 ? errors : undefined,
    disclaimer: 'Results are from indexed/clearnet aggregators only. No Tor access. PII/credentials automatically redacted.',
    timestamp: new Date().toISOString(),
  });
}
