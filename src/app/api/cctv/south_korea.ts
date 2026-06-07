import type { CctvCamera } from './types';

const KOREA_STATIC: CctvCamera[] = [
  { id: 'kr-0', lat: 37.5665, lng: 126.9780, name: 'Seoul - Gwanghwamun', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/wF_OFTJGfVk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-1', lat: 37.5596, lng: 126.9752, name: 'Seoul - Myeongdong', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/6bMB5TJAWTI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-2', lat: 37.5172, lng: 127.0473, name: 'Seoul - Gangnam Station', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/kLbGBOjXqfc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-3', lat: 37.5704, lng: 126.9912, name: 'Seoul - Dongdaemun', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/a7VJdG9bOoc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-4', lat: 37.5400, lng: 126.9500, name: 'Seoul - Yongsan', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/JnwJRFxPi70?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-5', lat: 37.5142, lng: 127.1060, name: 'Seoul - Olympic Park', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/mEzWc5X_JOQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-6', lat: 35.1796, lng: 129.0756, name: 'Busan - Haeundae Beach', city: 'Busan', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/5R3LiOJDCsU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-7', lat: 35.1090, lng: 129.0403, name: 'Busan - Nampo-dong', city: 'Busan', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/pC0bVJ5YDLQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-8', lat: 37.4563, lng: 126.7052, name: 'Incheon - Songdo', city: 'Incheon', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/vQXymwDQtWY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-9', lat: 35.8714, lng: 128.6014, name: 'Daegu - Suseong Lake', city: 'Daegu', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/IjHsqAZ7vvg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-10', lat: 36.3504, lng: 127.3845, name: 'Daejeon - Expo Bridge', city: 'Daejeon', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/Jxl1RfZqgOE?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-11', lat: 35.5384, lng: 129.3114, name: 'Ulsan - Taehwa River', city: 'Ulsan', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/lV26VdmimHU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-12', lat: 37.2750, lng: 127.0095, name: 'Suwon - Hwaseong Fortress', city: 'Suwon', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/LSwkOvAHixU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-13', lat: 37.6584, lng: 127.0678, name: 'Seoul - Nowon / I-1 Expressway', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/v_-cz4-v35I?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
  { id: 'kr-14', lat: 37.6176, lng: 126.9227, name: 'Seoul - Eunpyeong', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/ue5kPb9OYWM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ITS Korea' },
];

export async function fetchSouthKoreaCameras(): Promise<CctvCamera[]> {
  const apiKey = process.env.ITS_KOREA_API_KEY;
  if (!apiKey) return KOREA_STATIC;

  const cams: CctvCamera[] = [];
  try {
    const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${apiKey}&type=its&cctvType=1&minX=126&maxX=130&minY=34&maxY=38&getType=json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return KOREA_STATIC;
    const data = await res.json();
    const list: any[] = data?.response?.data || [];
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.coordY);
      const lng = parseFloat(cam.coordX);
      if (!lat || !lng) continue;
      cams.push({
        id: `kr-api-${i}`,
        lat,
        lng,
        name: cam.cctvname || `KR Camera ${i}`,
        city: cam.roadsectionid || 'South Korea',
        country: 'South Korea',
        stream_url: cam.cctvurl || undefined,
        stream_type: cam.cctvurl ? 'hls' : undefined,
        source: 'ITS Korea',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : KOREA_STATIC;
  } catch { return KOREA_STATIC; }
}
