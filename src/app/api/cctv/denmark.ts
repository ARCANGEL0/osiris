import type { CctvCamera } from './types';

const DENMARK_STATIC: CctvCamera[] = [
  { id: 'dk-0', lat: 55.6761, lng: 12.5683, name: 'Copenhagen - Rådhuspladsen', city: 'Copenhagen', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/rqVQ8qRLBiE?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-1', lat: 55.6786, lng: 12.5690, name: 'Copenhagen - Strøget', city: 'Copenhagen', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/XGzXZPB4a3s?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-2', lat: 55.6717, lng: 12.5613, name: 'Copenhagen - Nørreport Station', city: 'Copenhagen', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/nVJPjgGOJFk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-3', lat: 55.6602, lng: 12.5891, name: 'Copenhagen - Knippelsbro Bridge', city: 'Copenhagen', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/2bTn9h9QJNI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-4', lat: 56.1567, lng: 10.2108, name: 'Aarhus - Åboulevarden', city: 'Aarhus', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/3TlEXPsGYeI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-5', lat: 55.4038, lng: 10.4024, name: 'Odense - Vestergade', city: 'Odense', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/gqmVX-mFWgM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-6', lat: 57.0488, lng: 9.9217, name: 'Aalborg - Boulevarden', city: 'Aalborg', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/bm7LJJSzahw?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-7', lat: 55.7000, lng: 12.5500, name: 'Copenhagen - E20 Motorway', city: 'Copenhagen', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/KG5ANf1gUlA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-8', lat: 55.6400, lng: 12.0800, name: 'Roskilde - E20', city: 'Roskilde', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/CK7jmBOFjug?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
  { id: 'dk-9', lat: 54.9100, lng: 9.7900, name: 'Kolding - E45/E20 Junction', city: 'Kolding', country: 'Denmark', stream_url: 'https://www.youtube.com/embed/yN9_zJk4Yvg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Vejdirektoratet' },
];

export async function fetchDenmarkCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://api.vejdirektoratet.dk/api/v2/traffic/cameras', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return DENMARK_STATIC;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cameras || data?.features || []);
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.latitude || cam.lat || cam.geometry?.coordinates?.[1]);
      const lng = parseFloat(cam.longitude || cam.lng || cam.geometry?.coordinates?.[0]);
      if (!lat || !lng) continue;
      cams.push({
        id: `dk-api-${i}`,
        lat,
        lng,
        name: cam.name || cam.title || `DK Camera ${i}`,
        city: cam.municipality || 'Denmark',
        country: 'Denmark',
        feed_url: cam.imageUrl || cam.url || undefined,
        source: 'Vejdirektoratet',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : DENMARK_STATIC;
  } catch { return DENMARK_STATIC; }
}
