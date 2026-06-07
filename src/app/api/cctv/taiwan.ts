import type { CctvCamera } from './types';

const TAIWAN_STATIC: CctvCamera[] = [
  { id: 'tw-0', lat: 25.0330, lng: 121.5654, name: 'Taipei - Freeway No.1 N', city: 'Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/7JKgBBqoZzM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-1', lat: 25.0500, lng: 121.5300, name: 'Taipei - Huanhe Expressway', city: 'Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/qFpK4VpGE_c?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-2', lat: 24.9936, lng: 121.3010, name: 'Taoyuan - Freeway 1', city: 'Taoyuan', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/JyWOzRMWMOU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-3', lat: 24.1477, lng: 120.6736, name: 'Taichung - Freeway 1', city: 'Taichung', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/P5Cy2kXifT4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-4', lat: 22.9999, lng: 120.2269, name: 'Tainan - Freeway 1', city: 'Tainan', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/lE5IJPpbTR0?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-5', lat: 22.6273, lng: 120.3014, name: 'Kaohsiung - Freeway 1', city: 'Kaohsiung', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/hkRJV4z3yws?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-6', lat: 25.0478, lng: 121.5319, name: 'Taipei - Zhongxiao Bridge', city: 'Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/kMgIAaRlkrc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-7', lat: 24.8138, lng: 120.9675, name: 'Hsinchu - Freeway 1', city: 'Hsinchu', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/9VGe3DJPZZU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-8', lat: 23.9740, lng: 120.5731, name: 'Changhua - Freeway 3', city: 'Changhua', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/BRHF0mnxF_8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-9', lat: 23.4800, lng: 120.4491, name: 'Chiayi - Freeway 1', city: 'Chiayi', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/3sBriWLkA4s?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-10', lat: 24.3408, lng: 120.6541, name: 'Miaoli - Freeway 1', city: 'Miaoli', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/N2aFgQFn0U4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-11', lat: 22.7548, lng: 120.3428, name: 'Kaohsiung - Port Area', city: 'Kaohsiung', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/m5P0nZDqB8g?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-12', lat: 25.1349, lng: 121.4622, name: 'New Taipei - Danshui', city: 'New Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/EyqvHO-OIQY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-13', lat: 25.0176, lng: 121.4675, name: 'New Taipei - Banqiao', city: 'New Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/Z_PFvqsLfL8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-14', lat: 24.6900, lng: 121.7700, name: 'Yilan - Suhua Highway', city: 'Yilan', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/mLlMaLH9PSM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-15', lat: 22.3700, lng: 120.5900, name: 'Pingtung - Freeway 3', city: 'Pingtung', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/nknl8m-o5V8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-16', lat: 23.1420, lng: 120.2270, name: 'Tainan - Anping Port', city: 'Tainan', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/Ub7IA0sQOkg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-17', lat: 25.0780, lng: 121.5654, name: 'Taipei - Zhongshan District', city: 'Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/vlPkFMfVHsA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-18', lat: 25.0448, lng: 121.4965, name: 'Taipei - Neihu Technology Park', city: 'Taipei', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/rI9mT57HFCU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
  { id: 'tw-19', lat: 24.1519, lng: 120.6604, name: 'Taichung - Shuinan', city: 'Taichung', country: 'Taiwan', stream_url: 'https://www.youtube.com/embed/IKQ2v7c7p6k?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'Taiwan Freeway Bureau' },
];

export async function fetchTaiwanCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://tisvcloud.freeway.gov.tw/CCTV.json', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return TAIWAN_STATIC;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cctvs || data?.CCTV || []);
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.PositionLat || cam.lat);
      const lng = parseFloat(cam.PositionLon || cam.lng);
      if (!lat || !lng) continue;
      cams.push({
        id: `tw-api-${i}`,
        lat,
        lng,
        name: cam.CCTVId || cam.name || `TW Camera ${i}`,
        city: cam.RoadName || cam.road || 'Taiwan',
        country: 'Taiwan',
        stream_url: cam.VideoStreamURL || undefined,
        stream_type: cam.VideoStreamURL ? 'hls' : undefined,
        source: 'Taiwan Freeway Bureau',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : TAIWAN_STATIC;
  } catch { return TAIWAN_STATIC; }
}
