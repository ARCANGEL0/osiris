import type { CctvCamera } from './types';

export async function fetchCanadaBCCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch(
      'https://images.drivebc.ca/bchighwaycam/pub/cameras.json',
      { signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cameras || []);
    for (const cam of list) {
      const lat = parseFloat(cam.lat);
      const lng = parseFloat(cam.lon);
      if (!lat || !lng) continue;
      cams.push({
        id: `bc-${cam.camid}`,
        lat,
        lng,
        name: cam.camname || `BC Camera ${cam.camid}`,
        city: cam.highway || 'BC',
        country: 'Canada',
        feed_url: cam.imageurl || undefined,
        source: 'DriveBC',
      });
    }
  } catch { return []; }
  return cams.filter(c => c.lat && c.lng);
}
