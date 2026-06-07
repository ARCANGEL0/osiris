/**
 * Shodan API key rotation — round-robin across OSS plan keys.
 * OSS plan supports host lookups and facets (not search queries).
 * Keys loaded from env: SHODAN_API_KEY, SHODAN_API_KEY_1, SHODAN_API_KEY_2, SHODAN_API_KEY_3
 */

let _idx = 0;

export function getShodanKey(): string | null {
  const keys = [
    process.env.SHODAN_API_KEY,
    process.env.SHODAN_API_KEY_1,
    process.env.SHODAN_API_KEY_2,
    process.env.SHODAN_API_KEY_3,
  ].filter(Boolean) as string[];
  if (keys.length === 0) return null;
  const key = keys[_idx % keys.length];
  _idx = (_idx + 1) % keys.length;
  return key;
}

export async function shodanHostLookup(ip: string): Promise<any | null> {
  const key = getShodanKey();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${key}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
