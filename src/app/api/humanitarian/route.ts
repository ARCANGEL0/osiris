import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Country centroid lookup for ReliefWeb country codes
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'AF': [33.93, 67.71], 'AL': [41.15, 20.17], 'DZ': [28.03, 1.66], 'AO': [-11.20, 17.87],
  'AR': [-38.42, -63.62], 'AM': [40.07, 45.04], 'AU': [-25.27, 133.78], 'AZ': [40.14, 47.58],
  'BD': [23.68, 90.36], 'BI': [-3.37, 29.92], 'BF': [12.36, -1.56], 'BR': [-14.24, -51.93],
  'BO': [-16.29, -63.59], 'KH': [12.57, 104.99], 'CM': [3.85, 11.50], 'CD': [-4.04, 21.76],
  'CF': [6.61, 20.94], 'CL': [-35.68, -71.54], 'CN': [35.86, 104.20], 'CO': [4.57, -74.30],
  'CR': [9.75, -83.75], 'CU': [21.52, -77.78], 'ET': [9.15, 40.49], 'HT': [18.97, -72.29],
  'ID': [-0.79, 113.92], 'IQ': [33.22, 43.68], 'IR': [32.43, 53.69], 'KE': [-0.02, 37.91],
  'LA': [19.86, 102.50], 'LB': [33.85, 35.86], 'LY': [26.34, 17.23], 'ML': [17.57, -3.99],
  'MM': [21.92, 95.96], 'MZ': [-18.67, 35.53], 'NE': [17.61, 8.08], 'NG': [9.08, 8.68],
  'PK': [30.38, 69.35], 'PH': [12.88, 121.77], 'PS': [31.95, 35.23], 'RW': [-1.94, 29.87],
  'SO': [5.15, 46.20], 'SS': [6.88, 31.57], 'SD': [12.86, 30.22], 'SY': [34.80, 38.99],
  'TZ': [-6.37, 34.89], 'TJ': [38.86, 71.28], 'TG': [8.62, 0.82], 'UA': [48.38, 31.17],
  'UG': [1.37, 32.29], 'VE': [6.42, -66.59], 'VN': [14.06, 108.28], 'YE': [15.55, 48.52],
  'ZM': [-13.13, 27.85], 'ZW': [-19.02, 29.15],
};

const GDACS_TYPE_MAP: Record<string, string> = {
  EQ: 'Earthquake', TC: 'Tropical Cyclone', FL: 'Flood',
  VO: 'Volcano', WF: 'Wildfire', DR: 'Drought',
};

function parseGdacsRss(xml: string): any[] {
  const results: any[] = [];
  const items = xml.split('<item>').slice(1);
  for (const item of items) {
    const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() || '';
    const lat = parseFloat(get('geo:lat'));
    const lng = parseFloat(get('geo:long'));
    if (isNaN(lat) || isNaN(lng)) continue;
    const subject = get('dc:subject').toUpperCase();
    const typeCode = subject.replace(/\d+/g, '').substring(0, 2);
    const alertLevel = get('gdacs:alertlevel');
    results.push({
      id: get('guid') || `gdacs-${results.length}`,
      name: get('title').split('(')[0].trim() || 'GDACS Alert',
      date: get('pubDate'),
      country: get('gdacs:country') || 'Unknown',
      lat, lng,
      type: GDACS_TYPE_MAP[typeCode] || typeCode || 'Disaster',
      status: alertLevel?.toLowerCase() === 'red' ? 'critical' : alertLevel?.toLowerCase() === 'orange' ? 'serious' : 'ongoing',
      alert_level: alertLevel,
      source: 'GDACS',
      kind: 'disaster',
    });
  }
  return results;
}

export async function GET() {
  const disasters: any[] = [];

  // GDACS (Global Disaster Alerting Coordination System) — free, no key, real-time
  try {
    const res = await fetch('https://www.gdacs.org/xml/rss.xml', {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/4.2)', 'Accept': 'text/xml, application/xml' },
    });
    if (res.ok) {
      const xml = await res.text();
      disasters.push(...parseGdacsRss(xml));
    }
  } catch { /* silent */ }

  // ReliefWeb (requires approved appname — use env RELIEFWEB_APPNAME if set)
  const rwAppname = process.env.RELIEFWEB_APPNAME;
  if (rwAppname) {
    try {
      const res = await fetch(
        `https://api.reliefweb.int/v2/disasters?limit=50&sort[]=date:desc&appname=${encodeURIComponent(rwAppname)}&fields[include][]=name&fields[include][]=date&fields[include][]=country&fields[include][]=type&fields[include][]=status&fields[include][]=primary_type`,
        { signal: AbortSignal.timeout(10000), headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const d of (data?.data || [])) {
          const f = d.fields || {};
          const country = f.country?.[0];
          const cc = country?.iso3 || '';
          const coords = COUNTRY_COORDS[cc] || [null, null];
          if (!coords[0]) continue;
          disasters.push({
            id: `rw-${d.id}`, name: f.name || 'Unnamed Disaster',
            date: f.date?.created, country: country?.name || 'Unknown',
            lat: coords[0], lng: coords[1],
            type: f.primary_type?.name || 'Disaster',
            status: f.status, source: 'ReliefWeb', kind: 'disaster',
          });
        }
      }
    } catch { /* silent */ }
  }

  return NextResponse.json({
    disasters,
    total: disasters.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
