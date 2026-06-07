import type { CctvCamera } from './types';

function parseWkt(wkt: string): { lat: number; lng: number } | null {
  const m = wkt.match(/POINT\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s*\)/i);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

export async function fetchNorwayCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch(
      'https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/95?antall=200&inkluder=egenskaper,lokasjon&srid=wgs84',
      {
        signal: AbortSignal.timeout(12000),
        headers: { 'Accept': 'application/json' },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const objects: any[] = data?.objekter || [];
    for (const obj of objects) {
      const wkt: string = obj.lokasjon?.geometri?.wkt || '';
      const coords = parseWkt(wkt);
      if (!coords) continue;
      const egenskaper: any[] = obj.egenskaper || [];
      const nameProp = egenskaper.find((e: any) => e.id === 1078);
      const imgProp = egenskaper.find((e: any) => e.id === 5985);
      cams.push({
        id: `no-${obj.id}`,
        lat: coords.lat,
        lng: coords.lng,
        name: nameProp?.verdi || `Vegkamera ${obj.id}`,
        city: 'Norway',
        country: 'Norway',
        feed_url: imgProp?.verdi || undefined,
        source: 'Statens vegvesen',
      });
    }
  } catch { return []; }
  return cams.filter(c => c.lat && c.lng);
}
