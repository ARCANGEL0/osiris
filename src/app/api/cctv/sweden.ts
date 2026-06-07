import type { CctvCamera } from './types';

function parseWkt(wkt: string): { lat: number; lng: number } | null {
  const m = wkt.match(/POINT\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s*\)/i);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

const SWEDEN_STATIC: CctvCamera[] = [
  { id: 'se-1', lat: 59.3293, lng: 18.0686, name: 'Stockholm - Centralbron', city: 'Stockholm', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/RB8bHqY4JlA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-2', lat: 59.3326, lng: 18.0649, name: 'Stockholm - Slussen', city: 'Stockholm', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/yd9G6kFh9XA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-3', lat: 57.7089, lng: 11.9746, name: 'Gothenburg - Hamnbron', city: 'Gothenburg', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/kbPGe3v4dCI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-4', lat: 55.6050, lng: 13.0038, name: 'Malmö - Stortorget', city: 'Malmö', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/LyJ0Qa7dJz4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-5', lat: 59.8586, lng: 17.6389, name: 'Uppsala - Centrum', city: 'Uppsala', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/aFanK5P9N_A?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-6', lat: 59.3793, lng: 16.5144, name: 'Västerås - E18', city: 'Västerås', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/jOFGMVXC2gk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-7', lat: 58.4108, lng: 15.6214, name: 'Linköping - E4', city: 'Linköping', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/5_E9pBTYSBk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-8', lat: 59.2741, lng: 15.2066, name: 'Örebro - Centrum', city: 'Örebro', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/W6Z5O4GBSGI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-9', lat: 55.7047, lng: 13.1910, name: 'Lund - E22', city: 'Lund', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/bD4y3g9U3yg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-10', lat: 56.1612, lng: 15.5869, name: 'Karlskrona - E22', city: 'Karlskrona', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/J3V_ZSGV8i8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-11', lat: 63.8258, lng: 20.2630, name: 'Umeå - E4', city: 'Umeå', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/JLaLthFLO3g?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-12', lat: 65.5848, lng: 22.1547, name: 'Luleå - E4', city: 'Luleå', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/7PL5Yp28ASQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-13', lat: 60.6749, lng: 17.1413, name: 'Gävle - E4', city: 'Gävle', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/jlIivOtBybc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-14', lat: 56.6634, lng: 16.3566, name: 'Kalmar - E22', city: 'Kalmar', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/Vd7TGnXLN9A?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
  { id: 'se-15', lat: 57.6828, lng: 14.1426, name: 'Jönköping - E4', city: 'Jönköping', country: 'Sweden', stream_url: 'https://www.youtube.com/embed/iCpQ1sn9b7w?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Trafikverket SE' },
];

export async function fetchSwedenCameras(): Promise<CctvCamera[]> {
  const key = process.env.TRAFIKVERKET_API_KEY;
  if (!key) return SWEDEN_STATIC;

  const body = `<REQUEST><LOGIN authenticationkey="${key}"/><QUERY objecttype="Camera" schemaversion="1"><INCLUDE>Id</INCLUDE><INCLUDE>Name</INCLUDE><INCLUDE>Geometry.WGS84</INCLUDE><INCLUDE>PhotoUrl</INCLUDE><INCLUDE>Type</INCLUDE><INCLUDE>Active</INCLUDE></QUERY></REQUEST>`;

  try {
    const res = await fetch('https://api.trafikinfo.trafikverket.se/v2/data.json', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml', 'Accept': 'application/json' },
      body,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return SWEDEN_STATIC;
    const data = await res.json();
    const cameras: any[] = data?.RESPONSE?.RESULT?.[0]?.Camera || [];
    const cams: CctvCamera[] = [];
    for (let i = 0; i < cameras.length; i++) {
      const cam = cameras[i];
      if (!cam.Active) continue;
      const coords = parseWkt(cam.Geometry?.WGS84 || '');
      if (!coords) continue;
      cams.push({
        id: `se-api-${cam.Id || i}`,
        lat: coords.lat,
        lng: coords.lng,
        name: cam.Name || `Kamera ${cam.Id}`,
        city: 'Sweden',
        country: 'Sweden',
        feed_url: cam.PhotoUrl || undefined,
        source: 'Trafikverket SE',
      });
    }
    return cams.filter(c => c.lat && c.lng);
  } catch { return SWEDEN_STATIC; }
}
