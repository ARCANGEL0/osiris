import type { CctvCamera } from './types';

const NZ_STATIC: CctvCamera[] = [
  { id: 'nz-0', lat: -36.8485, lng: 174.7633, name: 'Auckland - Harbour Bridge', city: 'Auckland', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/Np3pMb2rJT8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-1', lat: -36.8666, lng: 174.7684, name: 'Auckland - SH1 Grafton', city: 'Auckland', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/TIuqhAi8Rak?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-2', lat: -36.7819, lng: 174.7490, name: 'Auckland - SH18 Upper Harbour', city: 'Auckland', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/OkUhJPOAfoc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-3', lat: -41.2865, lng: 174.7762, name: 'Wellington - Basin Reserve', city: 'Wellington', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/gZqRNEwJ_Cs?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-4', lat: -41.3050, lng: 174.7762, name: 'Wellington - Terrace Tunnel', city: 'Wellington', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/6jf4MXSQ3Ms?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-5', lat: -43.5321, lng: 172.6362, name: 'Christchurch - SH1 Brougham', city: 'Christchurch', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/O_XxlKvCJo4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-6', lat: -43.5240, lng: 172.5832, name: 'Christchurch - Waimakariri Bridge', city: 'Christchurch', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/K2ACJMi2FoY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-7', lat: -37.7870, lng: 175.2793, name: 'Hamilton - SH1', city: 'Hamilton', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/hPUiJlp87FM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-8', lat: -38.1368, lng: 176.2497, name: 'Rotorua - SH5', city: 'Rotorua', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/2WSnTJ5YgMk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
  { id: 'nz-9', lat: -45.8788, lng: 170.5028, name: 'Dunedin - SH1 One Way', city: 'Dunedin', country: 'New Zealand', stream_url: 'https://www.youtube.com/embed/H7DvZXcxc3s?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'NZTA' },
];

export async function fetchNewZealandCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://www.journeys.nzta.govt.nz/api/v1/cameras', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return NZ_STATIC;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cameras || []);
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.lat || cam.latitude);
      const lng = parseFloat(cam.lng || cam.longitude);
      if (!lat || !lng) continue;
      cams.push({
        id: `nz-api-${i}`,
        lat,
        lng,
        name: cam.name || cam.title || `NZ Camera ${i}`,
        city: cam.region || 'New Zealand',
        country: 'New Zealand',
        feed_url: cam.imageUrl || cam.image || undefined,
        source: 'NZTA',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : NZ_STATIC;
  } catch { return NZ_STATIC; }
}
