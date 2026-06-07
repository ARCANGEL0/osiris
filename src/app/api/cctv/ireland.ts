import type { CctvCamera } from './types';

const IRELAND_STATIC: CctvCamera[] = [
  { id: 'ie-0', lat: 53.3498, lng: -6.2603, name: 'Dublin - M50 at Red Cow', city: 'Dublin', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0001', source: 'TII Ireland' },
  { id: 'ie-1', lat: 53.3607, lng: -6.2610, name: 'Dublin - M50 Ballymount', city: 'Dublin', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0002', source: 'TII Ireland' },
  { id: 'ie-2', lat: 53.3888, lng: -6.2605, name: 'Dublin - M50 Finglas', city: 'Dublin', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0003', source: 'TII Ireland' },
  { id: 'ie-3', lat: 53.3462, lng: -6.2535, name: 'Dublin - N7 Naas Road', city: 'Dublin', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0010', source: 'TII Ireland' },
  { id: 'ie-4', lat: 53.3318, lng: -6.2488, name: 'Dublin - N81 Tallaght', city: 'Dublin', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0020', source: 'TII Ireland' },
  { id: 'ie-5', lat: 51.8979, lng: -8.4706, name: 'Cork - M8 Junction 14', city: 'Cork', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0100', source: 'TII Ireland' },
  { id: 'ie-6', lat: 51.9003, lng: -8.4682, name: 'Cork - N25 Dunkettle', city: 'Cork', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0101', source: 'TII Ireland' },
  { id: 'ie-7', lat: 53.2707, lng: -9.0568, name: 'Galway - N6 Castlegar', city: 'Galway', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0200', source: 'TII Ireland' },
  { id: 'ie-8', lat: 52.6638, lng: -8.6267, name: 'Limerick - M7 Dock Road', city: 'Limerick', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0300', source: 'TII Ireland' },
  { id: 'ie-9', lat: 53.7000, lng: -7.7900, name: 'Mullingar - N4', city: 'Mullingar', country: 'Ireland', feed_url: 'https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=C0400', source: 'TII Ireland' },
];

export async function fetchIrelandCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://trafficdata.tii.ie/publicmultifeed/trafficdata?format=json', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return IRELAND_STATIC;
    const data = await res.json();
    const cameras: any[] = data?.cctv || data?.cameras || [];
    for (let i = 0; i < cameras.length; i++) {
      const cam = cameras[i];
      const lat = parseFloat(cam.latitude || cam.lat);
      const lng = parseFloat(cam.longitude || cam.lng);
      if (!lat || !lng) continue;
      cams.push({
        id: `ie-api-${i}`,
        lat,
        lng,
        name: cam.name || cam.description || `TII Camera ${i}`,
        city: cam.county || 'Ireland',
        country: 'Ireland',
        feed_url: cam.imageUrl || `https://trafficdata.tii.ie/cctvController/getCCTVImage?cameraId=${cam.id || i}`,
        source: 'TII Ireland',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : IRELAND_STATIC;
  } catch { return IRELAND_STATIC; }
}
