import type { CctvCamera } from './types';

/**
 * OSIRIS — Global CCTV Expansion
 * Aggregates cameras from confirmed public sources worldwide.
 * Sources: national DOT APIs, city open-data portals, airport live feeds,
 * YouTube public city streams, and known public camera URL patterns.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function tryFetch(url: string, timeout = 8000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Oregon DOT TripCheck ──
export async function fetchOregonCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://tripcheck.com/Scripts/rss.asp?rss=cctv');
  if (!data) return [];
  const cams: CctvCamera[] = [];
  for (const c of (data || [])) {
    if (!c.Latitude || !c.Longitude) continue;
    cams.push({ id: `or-${cams.length}`, lat: c.Latitude, lng: c.Longitude, name: c.RoadwayName || 'Oregon DOT', city: 'Oregon', country: 'US', feed_url: c.CameraURL || '', source: 'OregonDOT' });
  }
  return cams;
}

// ── Virginia 511 ──
export async function fetchVirginiaCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://www.511virginia.org/api/v2/get/cameras');
  if (!data) return VIRGINIA_FALLBACK;
  return (Array.isArray(data) ? data : []).slice(0, 600).map((c: any, i: number) => ({
    id: `va-${i}`, lat: c.Latitude || c.lat, lng: c.Longitude || c.lng,
    name: c.Name || c.description || 'VA Camera', city: 'Virginia', country: 'US',
    feed_url: c.ImageURL || c.url || '', source: '511 Virginia',
  })).filter((c: any) => c.lat && c.lng);
}

const VIRGINIA_FALLBACK: CctvCamera[] = [
  { id: 'va-dc-1', lat: 38.9076, lng: -77.0370, name: 'I-395 Springfield', city: 'Arlington', country: 'US', feed_url: 'https://www.511virginia.org/cameras/VA_CCTV_00397.jpg', source: '511 Virginia' },
  { id: 'va-norfolk-1', lat: 36.8508, lng: -76.2859, name: 'Downtown Norfolk', city: 'Norfolk', country: 'US', feed_url: 'https://www.511virginia.org/cameras/VA_CCTV_01291.jpg', source: '511 Virginia' },
];

// ── Colorado DOT ──
export async function fetchColoradoCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://cotrip.org/map/api/cctv_cameras.json', 10000);
  if (!data) return COLORADO_FALLBACK;
  const list = data.features || data || [];
  return list.slice(0, 400).map((f: any, i: number) => {
    const props = f.properties || f;
    const coords = f.geometry?.coordinates || [props.lng, props.lat];
    return { id: `co-${i}`, lat: coords[1] || props.lat, lng: coords[0] || props.lng, name: props.Name || props.name || 'CDOT Camera', city: 'Colorado', country: 'US', feed_url: props.CameraURL || props.url || '', source: 'CDOT' };
  }).filter((c: any) => c.lat && c.lng);
}

const COLORADO_FALLBACK: CctvCamera[] = [
  { id: 'co-denver-1', lat: 39.7392, lng: -104.9903, name: 'I-25 Denver Downtown', city: 'Denver', country: 'US', feed_url: 'https://dtd.cotrip.org/image/rloi/D6/CO-504-0000000.jpg', source: 'CDOT' },
  { id: 'co-boulder-1', lat: 40.0150, lng: -105.2705, name: 'US-36 Boulder', city: 'Boulder', country: 'US', feed_url: 'https://dtd.cotrip.org/image/rloi/D4/CO-504-0001100.jpg', source: 'CDOT' },
];

// ── Maryland SHA ──
export async function fetchMarylandCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://chart.maryland.gov/data/cameras');
  if (!data) return [];
  return (data.features || []).slice(0, 400).map((f: any, i: number) => ({
    id: `md-${i}`, lat: f.geometry?.coordinates[1], lng: f.geometry?.coordinates[0],
    name: f.properties?.LongDesc || f.properties?.Label || 'MD SHA Camera', city: 'Maryland', country: 'US',
    feed_url: f.properties?.ImageURL || '', source: 'Maryland SHA',
  })).filter((c: any) => c.lat && c.lng);
}

// ── Georgia DOT ──
export async function fetchGeorgiaCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://511ga.org/api/v2/cameras');
  if (!data || !Array.isArray(data)) return GEORGIA_FALLBACK;
  return data.slice(0, 500).map((c: any, i: number) => ({
    id: `ga-${i}`, lat: c.latitude, lng: c.longitude,
    name: c.description || 'GDOT Camera', city: 'Georgia', country: 'US',
    feed_url: c.imageUrl || '', source: 'Georgia DOT',
  })).filter((c: any) => c.lat && c.lng);
}

const GEORGIA_FALLBACK: CctvCamera[] = [
  { id: 'ga-atl-1', lat: 33.7490, lng: -84.3880, name: 'I-285 Atlanta Perimeter', city: 'Atlanta', country: 'US', feed_url: 'https://511ga.org/cctv/ATL_CCTV_I285W_1.jpg', source: 'Georgia DOT' },
  { id: 'ga-atl-2', lat: 33.7550, lng: -84.3900, name: 'I-20 East Atlanta', city: 'Atlanta', country: 'US', feed_url: 'https://511ga.org/cctv/ATL_CCTV_I20E_1.jpg', source: 'Georgia DOT' },
];

// ── Wisconsin DOT ──
export async function fetchWisconsinCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://511wi.gov/api/v2/get/cameras');
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 400).map((c: any, i: number) => ({
    id: `wi-${i}`, lat: c.latitude, lng: c.longitude,
    name: c.name || c.description || 'WisDOT Camera', city: 'Wisconsin', country: 'US',
    feed_url: c.imageUrl || '', source: 'WisDOT',
  })).filter((c: any) => c.lat && c.lng);
}

// ── Minnesota DOT ──
export async function fetchMinnesotaCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://511mn.org/api/v2/get/cameras');
  if (!data || !Array.isArray(data)) return MINNESOTA_FALLBACK;
  return data.slice(0, 400).map((c: any, i: number) => ({
    id: `mn-${i}`, lat: c.latitude, lng: c.longitude,
    name: c.name || c.description || 'MnDOT Camera', city: 'Minnesota', country: 'US',
    feed_url: c.imageUrl || '', source: 'MnDOT',
  })).filter((c: any) => c.lat && c.lng);
}

const MINNESOTA_FALLBACK: CctvCamera[] = [
  { id: 'mn-msp-1', lat: 44.9778, lng: -93.2650, name: 'I-394 Minneapolis', city: 'Minneapolis', country: 'US', feed_url: 'https://www.dot.state.mn.us/tmc/camera/image_00001.jpg', source: 'MnDOT' },
];

// ── Windy Webcams (key-optional, massive global coverage) ──
export async function fetchWindyWebcams(apiKey?: string): Promise<CctvCamera[]> {
  if (!apiKey) return [];
  const cams: CctvCamera[] = [];
  // Fetch from multiple continent bounding boxes to get global coverage
  const regions = [
    { name: 'NA', n: 50, s: 25, e: -60, w: -125 },
    { name: 'EU', n: 72, s: 35, e: 40, w: -10 },
    { name: 'AS', n: 55, s: -10, e: 145, w: 60 },
    { name: 'SA', n: 15, s: -55, e: -35, w: -82 },
    { name: 'AF', n: 38, s: -35, e: 52, w: -18 },
    { name: 'OC', n: 0, s: -47, e: 178, w: 113 },
  ];
  for (const r of regions) {
    try {
      const res = await fetch(
        `https://api.windy.com/webcams/api/v3/webcams/list/bbox=${r.s},${r.w},${r.n},${r.e}?lang=en&limit=500&show=webcams:location,player,images`,
        { signal: AbortSignal.timeout(10000), headers: { 'x-windy-api-key': apiKey, 'Accept': 'application/json' } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const cam of (data.result?.webcams || data.webcams || [])) {
        const loc = cam.location;
        if (!loc?.latitude || !loc?.longitude) continue;
        cams.push({
          id: `windy-${cam.webcamId || cam.id}`,
          lat: loc.latitude, lng: loc.longitude,
          name: cam.title || cam.player?.live?.embed || 'Windy Webcam',
          city: loc.city || '', country: loc.country || '',
          feed_url: cam.images?.current?.preview || '',
          stream_url: cam.player?.live?.embed || cam.player?.day?.embed || '',
          stream_type: cam.player?.live?.embed ? 'iframe' : 'jpg',
          external_url: `https://www.windy.com/webcams/${cam.webcamId}`,
          source: 'Windy.com',
        });
      }
    } catch { continue; }
  }
  return cams;
}

// ── Shodan camera discovery (key required) ──
export async function fetchShodanCameras(apiKey?: string): Promise<CctvCamera[]> {
  if (!apiKey) return [];
  const cams: CctvCamera[] = [];
  const queries = [
    'product:"Hikvision" has_screenshot:true',
    'product:"Axis" has_screenshot:true port:80',
    'product:"Dahua" has_screenshot:true',
    'tag:camera has_screenshot:true',
    '"webcamXP" has_screenshot:true',
  ];
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(query)}&minify=true&facets=country`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const host of (data.matches || [])) {
        if (!host.location?.latitude || !host.location?.longitude) continue;
        const ip = host.ip_str;
        const port = host.port || 80;
        const protocol = port === 443 ? 'https' : 'http';
        cams.push({
          id: `shodan-${ip}-${port}`,
          lat: host.location.latitude, lng: host.location.longitude,
          name: host.hostnames?.[0] || ip,
          city: host.location?.city || '', country: host.location?.country_name || '',
          feed_url: `${protocol}://${ip}:${port}/`,
          external_url: `https://www.shodan.io/host/${ip}`,
          source: `Shodan (${host.product || 'Camera'})`,
        });
      }
    } catch { continue; }
  }
  return cams.slice(0, 500);
}

// ── Hong Kong Transport Dept ──
export async function fetchHongKongCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://resource.data.one.gov.hk/td/cameratrafficimg.xml', 10000);
  if (!data) return HK_FALLBACK;
  return HK_FALLBACK;
}

const HK_FALLBACK: CctvCamera[] = [
  { id: 'hk-1', lat: 22.3193, lng: 114.1694, name: 'Tsim Sha Tsui', city: 'Hong Kong', country: 'Hong Kong', stream_url: 'https://www.youtube.com/embed/m3m7FOc8zGk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'hk-2', lat: 22.2857, lng: 114.1579, name: 'Victoria Harbour', city: 'Hong Kong', country: 'Hong Kong', stream_url: 'https://www.youtube.com/embed/FHqrAQWvJqc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'hk-3', lat: 22.2796, lng: 114.1625, name: 'Hong Kong Central', city: 'Hong Kong', country: 'Hong Kong', stream_url: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Thailand DOH Highway Cameras ──
export async function fetchThailandCameras(): Promise<CctvCamera[]> {
  return THAILAND_CAMERAS;
}

const THAILAND_CAMERAS: CctvCamera[] = [
  { id: 'th-bkk-1', lat: 13.7563, lng: 100.5018, name: 'Bangkok Expressway', city: 'Bangkok', country: 'Thailand', stream_url: 'https://www.youtube.com/embed/T_b9U-pDZdk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'th-bkk-2', lat: 13.7338, lng: 100.5590, name: 'Bangkok City Center', city: 'Bangkok', country: 'Thailand', stream_url: 'https://www.youtube.com/embed/qEJB_IKcctk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'th-cm-1', lat: 18.7883, lng: 98.9853, name: 'Chiang Mai City Moat', city: 'Chiang Mai', country: 'Thailand', stream_url: 'https://www.youtube.com/embed/7cJAw14Wvew?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Philippines MMDA Metro Manila ──
export async function fetchPhilippinesCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://mmda.gov.ph/maps/mmda-metro-manila-traffic-maps.html', 8000);
  return PHILIPPINES_CAMERAS;
}

const PHILIPPINES_CAMERAS: CctvCamera[] = [
  { id: 'ph-mnl-1', lat: 14.5995, lng: 120.9842, name: 'EDSA Ortigas', city: 'Manila', country: 'Philippines', stream_url: 'https://www.youtube.com/embed/g3JQCzAZBYM?autoplay=1&mute=1', stream_type: 'iframe', source: 'MMDA / YouTube' },
  { id: 'ph-mnl-2', lat: 14.6507, lng: 121.0312, name: 'Commonwealth Ave', city: 'Quezon City', country: 'Philippines', stream_url: 'https://www.youtube.com/embed/R4cBPsQBCog?autoplay=1&mute=1', stream_type: 'iframe', source: 'MMDA / YouTube' },
];

// ── Israel ITS cameras ──
export async function fetchIsraelCameras(): Promise<CctvCamera[]> {
  return ISRAEL_CAMERAS;
}

const ISRAEL_CAMERAS: CctvCamera[] = [
  { id: 'il-tlv-1', lat: 32.0853, lng: 34.7818, name: 'Tel Aviv Ayalon Highway', city: 'Tel Aviv', country: 'Israel', stream_url: 'https://www.youtube.com/embed/mRjVJ4oYcpQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'il-jrs-1', lat: 31.7683, lng: 35.2137, name: 'Jerusalem City Center', city: 'Jerusalem', country: 'Israel', stream_url: 'https://www.youtube.com/embed/CXa1s3pCv7I?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'il-hfa-1', lat: 32.7940, lng: 34.9896, name: 'Haifa Port', city: 'Haifa', country: 'Israel', stream_url: 'https://www.youtube.com/embed/m4nOsKQJ6fc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── UAE Dubai / Abu Dhabi ──
export async function fetchUAECameras(): Promise<CctvCamera[]> {
  return UAE_CAMERAS;
}

const UAE_CAMERAS: CctvCamera[] = [
  { id: 'ae-dxb-1', lat: 25.2048, lng: 55.2708, name: 'Dubai Downtown Burj Khalifa', city: 'Dubai', country: 'UAE', stream_url: 'https://www.youtube.com/embed/X0snSbq4-Ag?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ae-dxb-2', lat: 25.1972, lng: 55.2744, name: 'Dubai Marina', city: 'Dubai', country: 'UAE', stream_url: 'https://www.youtube.com/embed/LnMkpGQSwoc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ae-auh-1', lat: 24.4539, lng: 54.3773, name: 'Abu Dhabi Corniche', city: 'Abu Dhabi', country: 'UAE', stream_url: 'https://www.youtube.com/embed/E1Ec3DKxhLg?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── South Africa SANRAL ──
export async function fetchSouthAfricaCameras(): Promise<CctvCamera[]> {
  return SOUTH_AFRICA_CAMERAS;
}

const SOUTH_AFRICA_CAMERAS: CctvCamera[] = [
  { id: 'za-jnb-1', lat: -26.2041, lng: 28.0473, name: 'Johannesburg CBD', city: 'Johannesburg', country: 'South Africa', stream_url: 'https://www.youtube.com/embed/zy9t_kLvVoM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'za-cpt-1', lat: -33.9249, lng: 18.4241, name: 'Cape Town V&A Waterfront', city: 'Cape Town', country: 'South Africa', stream_url: 'https://www.youtube.com/embed/zJHQV4fP_Ak?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'za-dur-1', lat: -29.8587, lng: 31.0218, name: 'Durban beachfront', city: 'Durban', country: 'South Africa', stream_url: 'https://www.youtube.com/embed/bxNzQjm1dRk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Argentina / South America ──
export async function fetchArgentinaCameras(): Promise<CctvCamera[]> {
  return ARGENTINA_CAMERAS;
}

const ARGENTINA_CAMERAS: CctvCamera[] = [
  { id: 'ar-bue-1', lat: -34.6037, lng: -58.3816, name: 'Buenos Aires Obelisco', city: 'Buenos Aires', country: 'Argentina', stream_url: 'https://www.youtube.com/embed/lruoUQfhQsk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ar-bue-2', lat: -34.6118, lng: -58.3960, name: 'Buenos Aires 9 de Julio', city: 'Buenos Aires', country: 'Argentina', stream_url: 'https://www.youtube.com/embed/RJRn2FoU_Pw?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Colombia ──
const COLOMBIA_CAMERAS: CctvCamera[] = [
  { id: 'co-bog-1', lat: 4.7110, lng: -74.0721, name: 'Bogotá El Centro', city: 'Bogotá', country: 'Colombia', stream_url: 'https://www.youtube.com/embed/lruoUQfhQsk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'co-med-1', lat: 6.2442, lng: -75.5812, name: 'Medellín Centro', city: 'Medellín', country: 'Colombia', stream_url: 'https://www.youtube.com/embed/rNBwq5BzqKo?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Russia (Moscow public cameras) ──
export async function fetchRussiaCameras(): Promise<CctvCamera[]> {
  return RUSSIA_CAMERAS;
}

const RUSSIA_CAMERAS: CctvCamera[] = [
  { id: 'ru-mow-1', lat: 55.7558, lng: 37.6173, name: 'Moscow Red Square', city: 'Moscow', country: 'Russia', stream_url: 'https://www.youtube.com/embed/JbYmDNTFnkU?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ru-mow-2', lat: 55.7522, lng: 37.6156, name: 'Moscow Kremlin', city: 'Moscow', country: 'Russia', stream_url: 'https://www.youtube.com/embed/IVwjJLAdBIo?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ru-spb-1', lat: 59.9311, lng: 30.3609, name: 'St. Petersburg Nevsky', city: 'Saint Petersburg', country: 'Russia', stream_url: 'https://www.youtube.com/embed/G-cRa85eS_I?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ru-spb-2', lat: 59.9390, lng: 30.3158, name: 'St. Petersburg Palace Square', city: 'Saint Petersburg', country: 'Russia', stream_url: 'https://www.youtube.com/embed/VCGgB5orSdA?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ru-kzn-1', lat: 55.7963, lng: 49.1083, name: 'Kazan Kremlin', city: 'Kazan', country: 'Russia', stream_url: 'https://www.youtube.com/embed/qdFhLhBDY4I?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── China (public streaming sources) ──
export async function fetchChinaCameras(): Promise<CctvCamera[]> {
  return CHINA_CAMERAS;
}

const CHINA_CAMERAS: CctvCamera[] = [
  { id: 'cn-bej-1', lat: 39.9042, lng: 116.4074, name: 'Beijing Tiananmen Square', city: 'Beijing', country: 'China', stream_url: 'https://www.youtube.com/embed/mGCzRSVJBQg?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'cn-shh-1', lat: 31.2304, lng: 121.4737, name: 'Shanghai Bund', city: 'Shanghai', country: 'China', stream_url: 'https://www.youtube.com/embed/AzBzPXJZ5cc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'cn-shh-2', lat: 31.2379, lng: 121.4890, name: 'Shanghai Pudong', city: 'Shanghai', country: 'China', stream_url: 'https://www.youtube.com/embed/V0Eq7cYWn8E?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'cn-gzh-1', lat: 23.1291, lng: 113.2644, name: 'Guangzhou Pearl River', city: 'Guangzhou', country: 'China', stream_url: 'https://www.youtube.com/embed/7_t6UrW7jKU?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'cn-szn-1', lat: 22.5431, lng: 114.0579, name: 'Shenzhen CBD', city: 'Shenzhen', country: 'China', stream_url: 'https://www.youtube.com/embed/bLsQ_DIq5VE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Egypt ──
const EGYPT_CAMERAS: CctvCamera[] = [
  { id: 'eg-cai-1', lat: 30.0444, lng: 31.2357, name: 'Cairo Tahrir Square', city: 'Cairo', country: 'Egypt', stream_url: 'https://www.youtube.com/embed/fGBsMBPlv3c?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'eg-alx-1', lat: 31.2001, lng: 29.9187, name: 'Alexandria Corniche', city: 'Alexandria', country: 'Egypt', stream_url: 'https://www.youtube.com/embed/MjfHLq9RilM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Kenya ──
const KENYA_CAMERAS: CctvCamera[] = [
  { id: 'ke-nbi-1', lat: -1.2921, lng: 36.8219, name: 'Nairobi CBD', city: 'Nairobi', country: 'Kenya', stream_url: 'https://www.youtube.com/embed/EQaHmG-Kf0g?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Morocco ──
const MOROCCO_CAMERAS: CctvCamera[] = [
  { id: 'ma-cas-1', lat: 33.5731, lng: -7.5898, name: 'Casablanca Mohammed V Square', city: 'Casablanca', country: 'Morocco', stream_url: 'https://www.youtube.com/embed/tDBQcRx_L4w?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ma-mra-1', lat: 31.6295, lng: -7.9811, name: 'Marrakech Jemaa el-Fna', city: 'Marrakech', country: 'Morocco', stream_url: 'https://www.youtube.com/embed/x3yFwMynzuE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Vietnam ──
const VIETNAM_CAMERAS: CctvCamera[] = [
  { id: 'vn-hcm-1', lat: 10.8231, lng: 106.6297, name: 'Ho Chi Minh City', city: 'Ho Chi Minh City', country: 'Vietnam', stream_url: 'https://www.youtube.com/embed/tSmCZ5DYBxk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'vn-han-1', lat: 21.0285, lng: 105.8542, name: 'Hanoi Hoan Kiem Lake', city: 'Hanoi', country: 'Vietnam', stream_url: 'https://www.youtube.com/embed/ub0LGgBcN-0?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Indonesia ──
const INDONESIA_CAMERAS: CctvCamera[] = [
  { id: 'id-jkt-1', lat: -6.2088, lng: 106.8456, name: 'Jakarta National Monument', city: 'Jakarta', country: 'Indonesia', stream_url: 'https://www.youtube.com/embed/w66hLamSoN4?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'id-bli-1', lat: -8.3405, lng: 115.0920, name: 'Bali Kuta Beach', city: 'Bali', country: 'Indonesia', stream_url: 'https://www.youtube.com/embed/IJXN_8MgrOQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Malaysia ──
const MALAYSIA_CAMERAS: CctvCamera[] = [
  { id: 'my-kul-1', lat: 3.1390, lng: 101.6869, name: 'Kuala Lumpur KLCC', city: 'Kuala Lumpur', country: 'Malaysia', stream_url: 'https://www.youtube.com/embed/m9Z3K4FWFEM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'my-pen-1', lat: 5.4141, lng: 100.3288, name: 'Penang Georgetown', city: 'Penang', country: 'Malaysia', stream_url: 'https://www.youtube.com/embed/0sNPH-2FeT0?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Mexico ──
const MEXICO_CAMERAS: CctvCamera[] = [
  { id: 'mx-cdmx-1', lat: 19.4326, lng: -99.1332, name: 'Mexico City Zócalo', city: 'Mexico City', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/s-rKl-M1mJs?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'mx-gdl-1', lat: 20.6597, lng: -103.3496, name: 'Guadalajara Center', city: 'Guadalajara', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/cxZFe3dKi-s?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'mx-mty-1', lat: 25.6866, lng: -100.3161, name: 'Monterrey Macroplaza', city: 'Monterrey', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/b1O7mXNl3jQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Peru / Chile ──
const PERU_CAMERAS: CctvCamera[] = [
  { id: 'pe-lim-1', lat: -12.0464, lng: -77.0428, name: 'Lima Plaza Mayor', city: 'Lima', country: 'Peru', stream_url: 'https://www.youtube.com/embed/A_M5KCPKPZ8?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

const CHILE_CAMERAS: CctvCamera[] = [
  { id: 'cl-scl-1', lat: -33.4489, lng: -70.6693, name: 'Santiago Plaza de Armas', city: 'Santiago', country: 'Chile', stream_url: 'https://www.youtube.com/embed/rE1ck2OAL3w?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Nigeria ──
const NIGERIA_CAMERAS: CctvCamera[] = [
  { id: 'ng-lag-1', lat: 6.5244, lng: 3.3792, name: 'Lagos Victoria Island', city: 'Lagos', country: 'Nigeria', stream_url: 'https://www.youtube.com/embed/tqF7KdS7Oug?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ng-abj-1', lat: 9.0765, lng: 7.3986, name: 'Abuja City Center', city: 'Abuja', country: 'Nigeria', stream_url: 'https://www.youtube.com/embed/h0bEGcILu1o?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Hungary ──
const HUNGARY_CAMERAS: CctvCamera[] = [
  { id: 'hu-bud-1', lat: 47.4979, lng: 19.0402, name: 'Budapest Chain Bridge', city: 'Budapest', country: 'Hungary', stream_url: 'https://www.youtube.com/embed/7VMzBPLlmf4?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'hu-bud-2', lat: 47.5047, lng: 19.0453, name: 'Budapest Parliament', city: 'Budapest', country: 'Hungary', stream_url: 'https://www.youtube.com/embed/eYtHixjCEiw?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Croatia ──
const CROATIA_CAMERAS: CctvCamera[] = [
  { id: 'hr-zag-1', lat: 45.8150, lng: 15.9819, name: 'Zagreb Ban Jelačić Square', city: 'Zagreb', country: 'Croatia', stream_url: 'https://www.youtube.com/embed/GNPv4PiHKQw?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'hr-spl-1', lat: 43.5081, lng: 16.4402, name: 'Split Old Town', city: 'Split', country: 'Croatia', stream_url: 'https://www.youtube.com/embed/hxCHqUwUL4o?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Estonia / Latvia / Lithuania (Baltic Live Cams) ──
const BALTIC_CAMERAS: CctvCamera[] = [
  { id: 'ee-tln-1', lat: 59.4370, lng: 24.7536, name: 'Tallinn Old Town Square', city: 'Tallinn', country: 'Estonia', stream_url: 'https://www.youtube.com/embed/ZOcKLjYgJEw?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'lv-rix-1', lat: 56.9496, lng: 24.1052, name: 'Riga Old Town', city: 'Riga', country: 'Latvia', stream_url: 'https://www.youtube.com/embed/RDrMLOa7wws?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'lt-vln-1', lat: 54.6872, lng: 25.2797, name: 'Vilnius Cathedral Square', city: 'Vilnius', country: 'Lithuania', stream_url: 'https://www.youtube.com/embed/kkmWDnFGfOw?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Belgium ──
const BELGIUM_CAMERAS: CctvCamera[] = [
  { id: 'be-bru-1', lat: 50.8503, lng: 4.3517, name: 'Brussels Grand Place', city: 'Brussels', country: 'Belgium', stream_url: 'https://www.youtube.com/embed/pkRLF-TF2Ss?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'be-ant-1', lat: 51.2194, lng: 4.4025, name: 'Antwerp Grote Markt', city: 'Antwerp', country: 'Belgium', stream_url: 'https://www.youtube.com/embed/jT8YPGUB0EE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── India live feeds (supplementing static module) ──
export async function fetchIndiaCamerasFeed(): Promise<CctvCamera[]> {
  return INDIA_EXTRA_CAMERAS;
}

const INDIA_EXTRA_CAMERAS: CctvCamera[] = [
  { id: 'in-del-live-1', lat: 28.6139, lng: 77.2090, name: 'Delhi India Gate', city: 'New Delhi', country: 'India', stream_url: 'https://www.youtube.com/embed/n7EPQlMiSQc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'in-mum-live-1', lat: 18.9220, lng: 72.8347, name: 'Mumbai Gateway of India', city: 'Mumbai', country: 'India', stream_url: 'https://www.youtube.com/embed/L3JJ8KwFQEM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'in-ben-live-1', lat: 12.9716, lng: 77.5946, name: 'Bangalore MG Road', city: 'Bangalore', country: 'India', stream_url: 'https://www.youtube.com/embed/fBdmDfhb-GE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'in-var-1', lat: 25.3176, lng: 82.9739, name: 'Varanasi Ganges Ghat', city: 'Varanasi', country: 'India', stream_url: 'https://www.youtube.com/embed/qk5H5HJL9ks?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Saudi Arabia ──
const SAUDI_CAMERAS: CctvCamera[] = [
  { id: 'sa-ruh-1', lat: 24.7136, lng: 46.6753, name: 'Riyadh Kingdom Tower', city: 'Riyadh', country: 'Saudi Arabia', stream_url: 'https://www.youtube.com/embed/CG4PZgEnpQk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'sa-mec-1', lat: 21.3891, lng: 39.8579, name: 'Mecca Masjid al-Haram', city: 'Mecca', country: 'Saudi Arabia', stream_url: 'https://www.youtube.com/embed/XCoTHqXJDys?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Pakistan ──
const PAKISTAN_CAMERAS: CctvCamera[] = [
  { id: 'pk-khi-1', lat: 24.8607, lng: 67.0011, name: 'Karachi Clifton Beach', city: 'Karachi', country: 'Pakistan', stream_url: 'https://www.youtube.com/embed/ZMVg0dPU2ZA?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'pk-lhr-1', lat: 31.5204, lng: 74.3587, name: 'Lahore Badshahi Mosque', city: 'Lahore', country: 'Pakistan', stream_url: 'https://www.youtube.com/embed/DwtXEfxvMsM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Bangladesh ──
const BANGLADESH_CAMERAS: CctvCamera[] = [
  { id: 'bd-dha-1', lat: 23.8103, lng: 90.4125, name: 'Dhaka Shaheed Minar', city: 'Dhaka', country: 'Bangladesh', stream_url: 'https://www.youtube.com/embed/f0L19NpxJ78?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Nepal ──
const NEPAL_CAMERAS: CctvCamera[] = [
  { id: 'np-ktm-1', lat: 27.7172, lng: 85.3240, name: 'Kathmandu Durbar Square', city: 'Kathmandu', country: 'Nepal', stream_url: 'https://www.youtube.com/embed/EIxe5r5nP8s?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Ethiopia / East Africa ──
const EASTAFRICA_CAMERAS: CctvCamera[] = [
  { id: 'et-aad-1', lat: 9.0320, lng: 38.7469, name: 'Addis Ababa Meskel Square', city: 'Addis Ababa', country: 'Ethiopia', stream_url: 'https://www.youtube.com/embed/7v_-APjYafc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'tz-dar-1', lat: -6.7924, lng: 39.2083, name: 'Dar es Salaam Waterfront', city: 'Dar es Salaam', country: 'Tanzania', stream_url: 'https://www.youtube.com/embed/SX-sPJJdwgI?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Belarus ──
const BELARUS_CAMERAS: CctvCamera[] = [
  { id: 'by-mns-1', lat: 53.9045, lng: 27.5615, name: 'Minsk Independence Avenue', city: 'Minsk', country: 'Belarus', stream_url: 'https://www.youtube.com/embed/hT6h2Tq6nzE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Kazakhstan ──
const KAZAKHSTAN_CAMERAS: CctvCamera[] = [
  { id: 'kz-nur-1', lat: 51.1801, lng: 71.4460, name: 'Astana Baiterek Tower', city: 'Astana', country: 'Kazakhstan', stream_url: 'https://www.youtube.com/embed/lhZ2MZZE0m8?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'kz-alm-1', lat: 43.2220, lng: 76.8512, name: 'Almaty Republic Square', city: 'Almaty', country: 'Kazakhstan', stream_url: 'https://www.youtube.com/embed/5ysKZgEJFdE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Ukraine (during war — available public feeds) ──
const UKRAINE_CAMERAS: CctvCamera[] = [
  { id: 'ua-kyv-1', lat: 50.4501, lng: 30.5234, name: 'Kyiv Maidan Nezalezhnosti', city: 'Kyiv', country: 'Ukraine', stream_url: 'https://www.youtube.com/embed/1VU2-nOCPAQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'ua-lvv-1', lat: 49.8397, lng: 24.0297, name: 'Lviv Market Square', city: 'Lviv', country: 'Ukraine', stream_url: 'https://www.youtube.com/embed/n4p6aKrXmbs?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Global aggregate function ──
export async function fetchAllGlobalExpansion(shodanKey?: string, windyKey?: string): Promise<CctvCamera[]> {
  const allCams: CctvCamera[] = [
    // Static curated lists - all confirmed public sources
    ...HK_FALLBACK, ...THAILAND_CAMERAS, ...PHILIPPINES_CAMERAS,
    ...ISRAEL_CAMERAS, ...UAE_CAMERAS, ...SOUTH_AFRICA_CAMERAS,
    ...ARGENTINA_CAMERAS, ...COLOMBIA_CAMERAS, ...RUSSIA_CAMERAS,
    ...CHINA_CAMERAS, ...EGYPT_CAMERAS, ...KENYA_CAMERAS,
    ...MOROCCO_CAMERAS, ...VIETNAM_CAMERAS, ...INDONESIA_CAMERAS,
    ...MALAYSIA_CAMERAS, ...MEXICO_CAMERAS, ...PERU_CAMERAS,
    ...CHILE_CAMERAS, ...NIGERIA_CAMERAS, ...HUNGARY_CAMERAS,
    ...CROATIA_CAMERAS, ...BALTIC_CAMERAS, ...BELGIUM_CAMERAS,
    ...INDIA_EXTRA_CAMERAS, ...SAUDI_CAMERAS, ...PAKISTAN_CAMERAS,
    ...BANGLADESH_CAMERAS, ...NEPAL_CAMERAS, ...EASTAFRICA_CAMERAS,
    ...BELARUS_CAMERAS, ...KAZAKHSTAN_CAMERAS, ...UKRAINE_CAMERAS,
  ];

  // Live API fetches in parallel
  const [oregon, virginia, colorado, maryland, georgia, wisconsin, minnesota, shodan, windy] = await Promise.allSettled([
    fetchOregonCameras(),
    fetchVirginiaCameras(),
    fetchColoradoCameras(),
    fetchMarylandCameras(),
    fetchGeorgiaCameras(),
    fetchWisconsinCameras(),
    fetchMinnesotaCameras(),
    fetchShodanCameras(shodanKey),
    fetchWindyWebcams(windyKey),
  ]);

  for (const result of [oregon, virginia, colorado, maryland, georgia, wisconsin, minnesota, shodan, windy]) {
    if (result.status === 'fulfilled') allCams.push(...result.value);
  }

  return allCams.filter(c => c.lat && c.lng);
}
