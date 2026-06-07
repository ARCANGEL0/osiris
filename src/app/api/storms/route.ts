import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const storms: any[] = [];

  // NHC Current Storms JSON
  try {
    const res = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const activeStorms: any[] = data?.activeStorms || [];
      for (const storm of activeStorms) {
        storms.push({
          id: storm.id || storm.atcfID,
          name: storm.name,
          basin: storm.basin,
          type: storm.classification || 'Tropical Cyclone',
          lat: parseFloat(storm.latitudeNumeric || storm.lat || 0),
          lng: parseFloat(storm.longitudeNumeric || storm.lng || 0),
          max_winds_mph: storm.maxWindsMPH || null,
          pressure_mb: storm.minPressureMB || null,
          movement: storm.movementDir ? `${storm.movementDir} at ${storm.movementSpeedMPH} mph` : null,
          category: storm.category || null,
          forecast_track: [],
          source: 'NHC NOAA',
        });
      }
    }
  } catch { /* silent */ }

  // Also try RSS parsing for Atlantic and E. Pacific
  for (const basin of ['at', 'ep']) {
    try {
      const res = await fetch(`https://www.nhc.noaa.gov/index-${basin}.xml`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'application/rss+xml, text/xml' },
      });
      if (res.ok) {
        const xml = await res.text();
        // Extract storm items from RSS — basic XML parsing
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
          const item = match[1];
          const title = item.match(/<title>([^<]+)<\/title>/)?.[1] || '';
          const desc = item.match(/<description>([^<]+)<\/description>/)?.[1] || '';
          const latMatch = desc.match(/(\d+\.\d+)N/);
          const lngMatch = desc.match(/(\d+\.\d+)W/);
          if (title && latMatch && lngMatch) {
            const stormId = `nhc-${basin}-${storms.length}`;
            if (!storms.find(s => s.name && title.includes(s.name))) {
              storms.push({
                id: stormId,
                name: title.replace(/Advisory.*/, '').trim(),
                basin: basin === 'at' ? 'Atlantic' : 'East Pacific',
                type: 'Tropical Cyclone',
                lat: parseFloat(latMatch[1]),
                lng: -parseFloat(lngMatch[1]),
                max_winds_mph: null,
                pressure_mb: null,
                movement: null,
                category: null,
                forecast_track: [],
                source: 'NHC RSS',
              });
            }
          }
        }
      }
    } catch { /* silent */ }
  }

  return NextResponse.json({
    storms,
    total: storms.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
  });
}
