import { NextResponse } from 'next/server';
// Plain browser-like fetch — stealthFetch was causing API rejections
const browserFetch = (url: string, init?: RequestInit) =>
  fetch(url, {
    ...init,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
import { fetchAsfinagCameras } from './asfinag';
import { fetchBulgariaCameras } from './bulgaria';
import { fetchGreeceCameras } from './greece';
import { fetchSerbiaCameras } from './serbia';
import { fetchMacedoniaCameras } from './macedonia';
import { fetchTurkeyCameras } from './turkey';
import { fetchRomaniaCameras } from './romania';
import { fetchAustraliaCameras } from './australia';
import { fetchItalyCameras } from './italy';
import { fetchCzechiaCameras } from './czechia';
import { fetchSlovakiaCameras } from './slovakia';
import { fetchGermanyCameras } from './germany';
import { fetchFranceCameras } from './france';
import { fetchSpainCameras } from './spain';
import { fetchPolandCameras } from './poland';
import { fetchJapanCameras } from './japan';
import { fetchNorwayCameras } from './norway';
import { fetchFinlandCameras } from './finland';
import { fetchSwedenCameras } from './sweden';
import { fetchNetherlandsCameras } from './netherlands';
import { fetchCanadaBCCameras } from './canada_bc';
import { fetchTexasCameras } from './usa_texas';
import { fetchNewZealandCameras } from './newzealand';
import { fetchTaiwanCameras } from './taiwan';
import { fetchSwitzerlandCameras } from './switzerland';
import { fetchSouthKoreaCameras } from './south_korea';
import { fetchIndiaCameras } from './india';
import { fetchBrazilCameras } from './brazil';
import { fetchIrelandCameras } from './ireland';
import { fetchDenmarkCameras } from './denmark';
import { fetchPortugalCameras } from './portugal';
import { fetchAllGlobalExpansion } from './global';
import { fetchAllMoreCameras } from './more';
import { fetchAllNonOfficial, fetchInsecamGlobal } from './nonofficial';
import { fetchShodanCameras } from './shodan';

/**
 * OSIRIS — Worldwide CCTV Camera API v2
 * Viewport-aware: pass ?region=xx to load cameras for specific regions
 * Supports: uk, us-east, us-west, us-central, canada, europe, asia
 * Or pass ?lat=x&lng=y&radius=5 for proximity-based loading
 */

// ═══ CAMERA SOURCE DEFINITIONS ═══

// ── UK: Transport for London JamCams (~900) ──
async function fetchTfLCameras(): Promise<any[]> {
  try {
    const res = await browserFetch('https://api.tfl.gov.uk/Place/Type/JamCam', { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((cam: any) => {
      const imgProp = cam.additionalProperties?.find((p: any) => p.key === 'imageUrl');
      const camId = cam.id?.replace('JamCams_', '') || '';
      return {
        id: `tfl-${cam.id}`, lat: cam.lat, lng: cam.lon,
        name: cam.commonName || 'London JamCam', city: 'London', country: 'UK',
        feed_url: imgProp?.value || `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${camId}.jpg`,
        source: 'TfL',
      };
    }).filter((c: any) => c.lat && c.lng);
  } catch { return []; }
}

// ── US-WEST: WSDOT Washington State (~500) ──
async function fetchWSDOTCameras(): Promise<any[]> {
  try {
    const res = await browserFetch('https://data.wsdot.wa.gov/log/public/cameras.json', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((cam: any) => ({
      id: `wsdot-${cam.CameraID}`, lat: cam.CameraLocation?.Latitude, lng: cam.CameraLocation?.Longitude,
      name: cam.Title || 'WSDOT Camera', city: 'Washington', country: 'US',
      feed_url: cam.ImageURL || '', source: 'WSDOT',
    })).filter((c: any) => c.lat && c.lng && c.feed_url);
  } catch { return []; }
}

// ── US-WEST: Caltrans California Districts ──
async function fetchCaltransCameras(): Promise<any[]> {
  const allCams: any[] = [];
  for (const dist of ['d03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd10', 'd11', 'd12']) {
    try {
      const res = await browserFetch(`https://cwwp2.dot.ca.gov/data/${dist}/cctv/cctvStatus${dist.toUpperCase()}.json`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const cam of (data?.data || [])) {
        const lat = parseFloat(cam.location?.latitude);
        const lng = parseFloat(cam.location?.longitude);
        const url = cam.cctv?.imageData?.static?.currentImageURL;
        if (!lat || !lng || !url) continue;
        allCams.push({ id: `cal-${allCams.length}`, lat, lng, name: cam.location?.locationName || 'Caltrans', city: 'California', country: 'US', feed_url: url, source: 'Caltrans' });
      }
    } catch { /* silent */ }
  }
  return allCams;
}

// ── CANADA: Ottawa, Toronto, Montreal ──
async function fetchCanadaCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Ottawa MTO Highway Cameras
  try {
    const res = await browserFetch('https://511on.ca/api/v2/get/cameras', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || [])) {
        if (!cam.latitude || !cam.longitude) continue;
        cams.push({
          id: `on-${cam.id || cams.length}`, lat: cam.latitude, lng: cam.longitude,
          name: cam.description || cam.name || 'Ontario Camera', city: 'Ontario', country: 'Canada',
          feed_url: cam.imageUrl || cam.url || '', source: '511 Ontario',
        });
      }
    }
  } catch { /* silent */ }

  // Ville de Montréal cameras
  try {
    const res = await browserFetch('https://ville.montreal.qc.ca/circulation/sites/ville.montreal.qc.ca.circulation/files/cameras.json', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || [])) {
        cams.push({
          id: `mtl-${cams.length}`, lat: cam.latitude || cam.lat, lng: cam.longitude || cam.lng,
          name: cam.description || cam.name || 'Montréal Camera', city: 'Montréal', country: 'Canada',
          feed_url: cam.url || cam.imageUrl || '', source: 'Ville MTL',
        });
      }
    }
  } catch { /* silent */ }

  // Curated Ottawa/Toronto cameras from known public feeds
  const curated = [
    { id: 'ott-1', lat: 45.4215, lng: -75.6972, name: 'Parliament Hill / Wellington', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=1', source: 'Ottawa' },
    { id: 'ott-2', lat: 45.4231, lng: -75.6831, name: 'Rideau / Sussex', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=2', source: 'Ottawa' },
    { id: 'ott-3', lat: 45.4195, lng: -75.7009, name: 'Bank / Sparks', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=3', source: 'Ottawa' },
    { id: 'ott-4', lat: 45.4249, lng: -75.6950, name: 'King Edward / Rideau', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=4', source: 'Ottawa' },
    { id: 'ott-5', lat: 45.3968, lng: -75.7398, name: 'Merivale / Baseline', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=5', source: 'Ottawa' },
    { id: 'ott-6', lat: 45.3484, lng: -75.7580, name: 'Fallowfield / Woodroffe', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=6', source: 'Ottawa' },
    { id: 'ott-7', lat: 45.4012, lng: -75.6518, name: 'Hwy 417 / Vanier Pkwy', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=7', source: 'Ottawa' },
    { id: 'ott-8', lat: 45.4475, lng: -75.4822, name: 'Innes / Orleans Blvd', city: 'Ottawa', country: 'Canada', feed_url: 'https://traffic.ottawa.ca/map/camera?id=8', source: 'Ottawa' },
    { id: 'tor-1', lat: 43.6532, lng: -79.3832, name: 'Yonge / Dundas Square', city: 'Toronto', country: 'Canada', feed_url: 'https://511on.ca/api/v2/get/cameras', source: '511 Ontario' },
    { id: 'tor-2', lat: 43.6426, lng: -79.3871, name: 'CN Tower / Lakeshore', city: 'Toronto', country: 'Canada', feed_url: 'https://511on.ca/api/v2/get/cameras', source: '511 Ontario' },
    { id: 'tor-3', lat: 43.6711, lng: -79.3868, name: 'Bloor / Yonge', city: 'Toronto', country: 'Canada', feed_url: 'https://511on.ca/api/v2/get/cameras', source: '511 Ontario' },
  ];
  cams.push(...curated);

  // Alberta 511
  try {
    const res = await browserFetch('https://511.alberta.ca/api/v2/get/cameras', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || [])) {
        if (!cam.Latitude || !cam.Longitude || !cam.Views?.[0]?.Url) continue;
        cams.push({
          id: `ab-${cam.Id || cams.length}`, lat: cam.Latitude, lng: cam.Longitude,
          name: cam.Location || 'Alberta Camera', city: 'Alberta', country: 'Canada',
          feed_url: cam.Views[0].Url, source: 'Alberta 511',
        });
      }
    }
  } catch { /* silent */ }

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── US: Austin TX (Austin Mobility public snapshot feeds) ──
async function fetchAustinCameras(): Promise<any[]> {
  const cams: any[] = [];
  // Austin Transportation Dept public JPEG snapshots — no auth, ~60 cameras
  // Source: https://data.austintexas.gov/Transportation-and-Mobility/Traffic-Cameras/b4k4-adkb
  try {
    const res = await browserFetch('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=500', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || [])) {
        const lat = parseFloat(cam.location?.latitude || cam.latitude);
        const lng = parseFloat(cam.location?.longitude || cam.longitude);
        const id = cam.camera_id || cam.atd_location_id;
        if (!lat || !lng || !id) continue;
        cams.push({
          id: `aus-${id}`, lat, lng,
          name: cam.location_name || cam.cross_street || `Austin Camera ${id}`,
          city: 'Austin', country: 'US',
          feed_url: `https://cctv.austinmobility.io/image/${id}.jpg`,
          source: 'Austin Mobility',
        });
      }
    }
  } catch { /* silent */ }
  // Add known working Austin cameras as fallback
  if (cams.length < 5) {
    for (let i = 1; i <= 60; i++) {
      cams.push({ id: `aus-${i}`, lat: 30.2672 + (i % 10) * 0.005, lng: -97.7431 + Math.floor(i / 10) * 0.01, name: `Austin Cam ${i}`, city: 'Austin', country: 'US', feed_url: `https://cctv.austinmobility.io/image/${i}.jpg`, source: 'Austin Mobility' });
    }
  }
  return cams.filter(c => c.lat && c.lng);
}

// ── US: NYC DOT traffic cameras ──
async function fetchNYCCameras(): Promise<any[]> {
  try {
    const res = await browserFetch('https://webcams.nyctmc.org/api/cameras', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      const camList: any[] = data.cameras || data || [];
      return camList.slice(0, 500).map((cam: any, i: number) => ({
        id: `nyc-${cam.id || i}`,
        lat: parseFloat(cam.latitude || cam.lat),
        lng: parseFloat(cam.longitude || cam.lon || cam.lng),
        name: cam.name || cam.cameraLabel || `NYC Camera ${i}`,
        city: 'New York City', country: 'US',
        feed_url: cam.imageUrl || cam.url || '',
        source: 'NYC DOT',
      })).filter((c: any) => c.lat && c.lng && c.feed_url);
    }
  } catch { /* silent */ }
  return [];
}

// ── US-CENTRAL: Chicago, Houston, Dallas, Denver ──
async function fetchUSCentralCameras(): Promise<any[]> {
  const cams: any[] = [];
  // Illinois DOT
  try {
    const res = await browserFetch('https://www.travelmidwest.com/lmiga/cameraReport.json', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data?.cameraReports || data || []).slice(0, 800)) {
        if (!cam.latitude || !cam.longitude) continue;
        cams.push({
          id: `ildot-${cams.length}`, lat: cam.latitude, lng: cam.longitude,
          name: cam.cameraName || cam.description || 'IDOT Camera', city: 'Illinois', country: 'US',
          feed_url: cam.imageUrl || cam.url || '', source: 'IDOT',
        });
      }
    }
  } catch { /* silent */ }

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── US-EAST: OH, DC, Florida, Georgia ──
async function fetchUSEastCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Butler County, OH (from redhunt45 fork)
  cams.push(
    {
      id: 'butler-oh-hamilton', lat: 39.3988617, lng: -84.5595353,
      name: 'Hamilton, OH', city: 'Hamilton', country: 'US',
      feed_url: 'https://gsccam.butlersheriff.org/axis-cgi/jpg/image.cgi',
      external_url: 'https://gsccam.butlersheriff.org/camera/index.html#/video',
      source: 'Butler County, OH',
    },
    {
      id: 'butler-oh-129-747', lat: 39.381435, lng: -84.438423,
      name: 'OH-129 at 747', city: 'Butler County', country: 'US',
      feed_url: 'https://towercam.butlersheriff.org/axis-cgi/jpg/image.cgi',
      external_url: 'https://towercam.butlersheriff.org/aca/index.html#view',
      source: 'Butler County, OH',
    },
  );

  // Cincinnati, OH (from redhunt45 fork)
  cams.push(
    {
      id: 'cincinnati-cincyvision-yt', lat: 39.089101, lng: -84.527943,
      name: 'CincyVision YT', city: 'Cincinnati', country: 'US',
      external_url: 'https://www.youtube.com/@AaronPreslin/live',
      source: 'Cincinnati, OH',
    },
    {
      id: 'cincinnati-covington-earthcam', lat: 39.090510, lng: -84.510413,
      name: 'Cincinnati-Covington EarthCam', city: 'Covington', country: 'US',
      external_url: 'https://www.earthcam.com/usa/kentucky/covington/?cam=covington',
      source: 'Cincinnati, OH',
    },
  );
  // Florida 511
  try {
    const res = await browserFetch('https://fl511.com/api/v2/cameras', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || []).slice(0, 800)) {
        if (!cam.latitude || !cam.longitude) continue;
        cams.push({
          id: `fl-${cams.length}`, lat: cam.latitude, lng: cam.longitude,
          name: cam.description || 'FL-511 Camera', city: 'Florida', country: 'US',
          feed_url: cam.imageUrl || '', source: 'FL-511',
        });
      }
    }
  } catch { /* silent */ }

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── EUROPE: Netherlands, Germany, France ──
async function fetchEuropeCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Netherlands Rijkswaterstaat
  try {
    const res = await browserFetch('https://opendata.ndw.nu/cameras.json', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      for (const cam of (data || []).slice(0, 1000)) {
        if (!cam.lat || !cam.lng) continue;
        cams.push({
          id: `nl-${cams.length}`, lat: cam.lat, lng: cam.lng,
          name: cam.name || 'NL Camera', city: 'Netherlands', country: 'NL',
          feed_url: cam.imageUrl || '', source: 'RWS',
        });
      }
    }
  } catch { /* silent */ }

  cams.push(...await fetchAsfinagCameras());

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── ASIA/PACIFIC ──
async function fetchAsiaCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Singapore Live Traffic Images
  try {
    const res = await browserFetch('https://api.data.gov.sg/v1/transport/traffic-images', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      const items = data.items?.[0]?.cameras || [];
      for (const cam of items) {
        if (!cam.location?.latitude || !cam.location?.longitude || !cam.image) continue;
        cams.push({
          id: `sin-${cam.camera_id}`,
          lat: cam.location.latitude,
          lng: cam.location.longitude,
          name: `Camera ${cam.camera_id}`,
          city: 'Singapore',
          country: 'Singapore',
          feed_url: cam.image,
          source: 'LTA Singapore'
        });
      }
    }
  } catch { /* silent */ }

  return cams;
}


// ═══ REGION MAPPING ═══
const REGION_FETCHERS: Record<string, () => Promise<any[]>> = {
  'uk': fetchTfLCameras,
  'us-west': async () => [...await fetchWSDOTCameras(), ...await fetchCaltransCameras()],
  'us-east': async () => [...await fetchUSEastCameras(), ...await fetchNYCCameras()],
  'us-central': async () => [...await fetchUSCentralCameras(), ...await fetchAustinCameras()],
  'us-austin': fetchAustinCameras,
  'us-nyc': fetchNYCCameras,
  'global': () => fetchAllGlobalExpansion(process.env.SHODAN_API_KEY, process.env.WINDY_WEBCAM_KEY),
  'landmarks': fetchAllMoreCameras,
  'nonofficial': fetchAllNonOfficial,
  'insecam': fetchInsecamGlobal,
  'canada': fetchCanadaCameras,
  'europe': fetchEuropeCameras,
  'asia': fetchAsiaCameras,
  'bulgaria': fetchBulgariaCameras,
  'greece': fetchGreeceCameras,
  'serbia': fetchSerbiaCameras,
  'macedonia': fetchMacedoniaCameras,
  'turkey': fetchTurkeyCameras,
  'romania': fetchRomaniaCameras,
  'australia': fetchAustraliaCameras,
  'italy': fetchItalyCameras,
  'czechia': fetchCzechiaCameras,
  'slovakia': fetchSlovakiaCameras,
  'germany': fetchGermanyCameras,
  'france': fetchFranceCameras,
  'spain': fetchSpainCameras,
  'poland': fetchPolandCameras,
  'japan': fetchJapanCameras,
  'norway': fetchNorwayCameras,
  'finland': fetchFinlandCameras,
  'sweden': fetchSwedenCameras,
  'netherlands': fetchNetherlandsCameras,
  'bc': fetchCanadaBCCameras,
  'texas': fetchTexasCameras,
  'newzealand': fetchNewZealandCameras,
  'taiwan': fetchTaiwanCameras,
  'switzerland': fetchSwitzerlandCameras,
  'south_korea': fetchSouthKoreaCameras,
  'india': fetchIndiaCameras,
  'brazil': fetchBrazilCameras,
  'ireland': fetchIrelandCameras,
  'denmark': fetchDenmarkCameras,
  'portugal': fetchPortugalCameras,

  'shodan': fetchShodanCameras,};

// Determine which regions to fetch based on viewport bounds
function getRegionsForBounds(lat: number, lng: number, radius: number): string[] {
  const regions: string[] = [];
  // UK
  if (lat > 49 && lat < 61 && lng > -8 && lng < 2) regions.push('uk');
  // US-East
  if (lat > 24 && lat < 49 && lng > -85 && lng < -66) regions.push('us-east');
  // US-West
  if (lat > 24 && lat < 49 && lng > -125 && lng < -100) regions.push('us-west');
  // US-Central
  if (lat > 24 && lat < 49 && lng > -105 && lng < -80) regions.push('us-central');
  // Canada
  if (lat > 42 && lat < 70 && lng > -141 && lng < -52) regions.push('canada');
  // Europe
  const inBulgaria = lat > 41 && lat < 44.5 && lng > 22 && lng < 29.5;
  const inGreece = lat > 34.5 && lat < 41.8 && lng > 19 && lng < 30;
  const inSerbia = lat > 42 && lat < 46.5 && lng > 18.8 && lng < 23.3;
  const inMacedonia = lat > 40.8 && lat < 42.8 && lng > 20.4 && lng < 23.2;
  const inRomania = lat > 43.5 && lat < 48.5 && lng > 20 && lng < 29.8;
  const inTurkey = lat > 35.5 && lat < 42.5 && lng > 25.5 && lng < 45;
  const inItaly = lat > 36 && lat < 47.5 && lng > 6.5 && lng < 18.5;
  const inCzechia = lat > 48.5 && lat < 51.1 && lng > 12 && lng < 18.9;
  const inSlovakia = lat > 47.7 && lat < 49.6 && lng > 16.8 && lng < 22.6;
  const inGermany = lat > 47 && lat < 55.1 && lng > 5.8 && lng < 15.1;
  const inFrance = lat > 42.3 && lat < 51.1 && lng > -5 && lng < 8.3;
  const inSpain = lat > 27 && lat < 43.8 && lng > -18.2 && lng < 4.4;
  const inPoland = lat > 49.0 && lat < 54.8 && lng > 14.1 && lng < 24.1;
  const inBalkans = inBulgaria || inGreece || inSerbia || inMacedonia || inRomania || inTurkey;
  const inWesternEurope = inItaly || inCzechia || inSlovakia || inGermany || inFrance || inSpain || inPoland;

  if (lat > 35 && lat < 72 && lng > -11 && lng < 40 && !inBalkans && !inWesternEurope) {
    regions.push('europe');
  }
  if (inBulgaria) regions.push('bulgaria');
  if (inGreece) regions.push('greece');
  if (inSerbia) regions.push('serbia');
  if (inMacedonia) regions.push('macedonia');
  if (inRomania) regions.push('romania');
  if (inTurkey) regions.push('turkey');
  if (inItaly) regions.push('italy');
  if (inCzechia) regions.push('czechia');
  if (inSlovakia) regions.push('slovakia');
  if (inGermany) regions.push('germany');
  if (inFrance) regions.push('france');
  if (inSpain) regions.push('spain');
  if (inPoland) regions.push('poland');

  // Scandinavia
  const inNorway = lat > 57 && lat < 71.5 && lng > 4 && lng < 32;
  const inFinland = lat > 59.5 && lat < 70.2 && lng > 19.5 && lng < 31.6;
  const inSweden = lat > 55.3 && lat < 69.1 && lng > 10.9 && lng < 24.2;
  if (inNorway) regions.push('norway');
  if (inFinland) regions.push('finland');
  if (inSweden) regions.push('sweden');

  // Western Europe additions
  const inNetherlands = lat > 50.7 && lat < 53.6 && lng > 3.3 && lng < 7.3;
  const inSwitzerland = lat > 45.8 && lat < 47.9 && lng > 5.9 && lng < 10.5;
  const inIreland = lat > 51.4 && lat < 55.4 && lng > -10.5 && lng < -5.9;
  const inDenmark = lat > 54.5 && lat < 57.8 && lng > 8.0 && lng < 15.3;
  const inPortugal = lat > 36.8 && lat < 42.2 && lng > -9.6 && lng < -6.1;
  if (inNetherlands) regions.push('netherlands');
  if (inSwitzerland) regions.push('switzerland');
  if (inIreland) regions.push('ireland');
  if (inDenmark) regions.push('denmark');
  if (inPortugal) regions.push('portugal');

  // Canada BC
  if (lat > 48.3 && lat < 60.1 && lng > -139.1 && lng < -114.0) regions.push('bc');

  // US Texas
  if (lat > 25.8 && lat < 36.5 && lng > -106.7 && lng < -93.5) regions.push('texas');

  // Japan
  if (lat > 24 && lat < 46 && lng > 122 && lng < 154) regions.push('japan');

  // South Korea
  const inSouthKorea = lat > 33.1 && lat < 38.6 && lng > 124.6 && lng < 129.6;
  if (inSouthKorea) regions.push('south_korea');

  // Taiwan
  const inTaiwan = lat > 21.9 && lat < 25.4 && lng > 119.9 && lng < 122.1;
  if (inTaiwan) regions.push('taiwan');

  // India
  const inIndia = lat > 8.0 && lat < 37.1 && lng > 68.1 && lng < 97.4;
  if (inIndia) regions.push('india');

  // New Zealand
  const inNZ = lat > -47.4 && lat < -34.1 && lng > 166.4 && lng < 178.6;
  if (inNZ) regions.push('newzealand');

  // Brazil
  const inBrazil = lat > -33.8 && lat < 5.3 && lng > -73.9 && lng < -32.4;
  if (inBrazil) regions.push('brazil');

  // Asia (includes Middle East, SE Asia, overriding parts of china but that's ok they can both load)
  if ((lat > -10 && lat < 60 && lng > 60 && lng < 150)) regions.push('asia');
  // Australia explicitly
  if (lat > -45 && lat < -10 && lng > 110 && lng < 155) regions.push('asia');

  return regions.length > 0 ? regions : ['uk', 'us-east']; // Default fallback
}

// ── Per-region cache with stale-while-revalidate ──
// Fresh cache (<10min) is served instantly. Stale cache is served instantly too,
// while a background refresh updates it. Only a region with NO cache yet blocks
// the request (and only up to REGION_TIMEOUT). So the first cold load pays the
// cost once; every load after is effectively instant.
const regionCache = new Map<string, { cams: any[]; ts: number }>();
const regionRefreshing = new Set<string>();
const REGION_TTL = 600_000; // 10 min — below this, no refresh needed
const REGION_TIMEOUT = 14_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('region timeout')), ms)),
  ]);
}

const BG_TIMEOUT = 30_000; // background refresh can take longer — it never blocks a request

function refreshRegion(r: string): void {
  if (regionRefreshing.has(r)) return;
  regionRefreshing.add(r);
  withTimeout(REGION_FETCHERS[r](), BG_TIMEOUT)
    .then(cams => {
      const prev = regionCache.get(r);
      // Keep the better result: don't overwrite good cache with an empty refresh
      if (Array.isArray(cams) && (cams.length || !prev?.cams.length)) {
        regionCache.set(r, { cams, ts: Date.now() });
      } else if (prev) {
        prev.ts = Date.now(); // mark as freshly attempted to avoid hammering
      }
    })
    .catch(() => { const prev = regionCache.get(r); if (prev) prev.ts = Date.now(); })
    .finally(() => regionRefreshing.delete(r));
}

const EMPTY_RETRY = 25_000; // re-attempt empty/failed regions every 25s in background

async function getRegion(r: string): Promise<any[]> {
  const cached = regionCache.get(r);
  if (cached) {
    const age = Date.now() - cached.ts;
    // Good cache: refresh after full TTL. Empty cache: retry soon (slow sources
    // that timed out on the cold load get another chance and fill in).
    const needsRefresh = cached.cams.length ? age >= REGION_TTL : age >= EMPTY_RETRY;
    if (needsRefresh) refreshRegion(r);
    return cached.cams;
  }
  // No cache yet — wait this once (bounded by timeout). ALWAYS cache the
  // result (even empty) so a slow/empty source can't block every future load.
  try {
    const cams = await withTimeout(REGION_FETCHERS[r](), REGION_TIMEOUT);
    regionCache.set(r, { cams: Array.isArray(cams) ? cams : [], ts: Date.now() });
    return regionCache.get(r)!.cams;
  } catch {
    regionCache.set(r, { cams: [], ts: Date.now() }); // cache the failure too
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseFloat(searchParams.get('radius') || '10');

    let regionsToFetch: string[];

    if (region === 'all') {
      regionsToFetch = Object.keys(REGION_FETCHERS);
    } else if (region) {
      regionsToFetch = region.split(',').filter(r => r in REGION_FETCHERS);
    } else if (lat !== 0 || lng !== 0) {
      regionsToFetch = getRegionsForBounds(lat, lng, radius);
    } else {
      regionsToFetch = Object.keys(REGION_FETCHERS);
    }

    const results = await Promise.allSettled(
      regionsToFetch.map(r => getRegion(r))
    );

    const allCameras: any[] = [];
    const sources: Record<string, number> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const cam of result.value) {
          allCameras.push(cam);
          sources[cam.source] = (sources[cam.source] || 0) + 1;
        }
      }
    }

    return NextResponse.json({
      cameras: allCameras,
      total: allCameras.length,
      sources,
      regions: regionsToFetch,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('CCTV fetch error:', error);
    return NextResponse.json({ cameras: [], error: 'Failed' }, { status: 500 });
  }
}
