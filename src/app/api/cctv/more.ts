import type { CctvCamera } from './types';

/**
 * OSIRIS — Extended Global CCTV Sources
 * Airport cameras, beach/nature webcams, port cameras, university feeds,
 * and regional DOT cameras not in the primary modules.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function tryFetch(url: string, timeout = 8000): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'Accept': 'application/json', 'User-Agent': UA } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

// ── UK National Highways (England motorway cameras) ──
export async function fetchUKHighwayCameras(): Promise<CctvCamera[]> {
  const data = await tryFetch('https://webtris.highwaysengland.co.uk/api/v1/SiteRunReports/sites?pageNum=1&pageSize=1000', 10000);
  if (!data?.Row) return UK_HIGHWAY_FALLBACK;
  return (data.Row || []).slice(0, 500).map((s: any, i: number) => ({
    id: `ukhe-${s.Id || i}`, lat: parseFloat(s.Latitude), lng: parseFloat(s.Longitude),
    name: s.Description || `UK Highway Cam ${i}`, city: 'England', country: 'UK',
    feed_url: `https://www.theaa.com/route-planner/guide/traffic-cameras/${s.Id}`,
    source: 'National Highways England',
  })).filter((c: any) => c.lat && c.lng && !isNaN(c.lat));
}

const UK_HIGHWAY_FALLBACK: CctvCamera[] = [
  { id: 'ukhe-m25-1', lat: 51.4950, lng: -0.4080, name: 'M25 Junction 10', city: 'Surrey', country: 'UK', stream_url: 'https://www.youtube.com/embed/HWL-NXxRJ6E?autoplay=1&mute=1', stream_type: 'iframe', source: 'National Highways' },
  { id: 'ukhe-m1-1', lat: 52.0360, lng: -1.1960, name: 'M1 J17 Midlands', city: 'Northamptonshire', country: 'UK', stream_url: 'https://www.youtube.com/embed/cDHnOe9S8HE?autoplay=1&mute=1', stream_type: 'iframe', source: 'National Highways' },
];

// ── Scotland Traffic cameras ──
export async function fetchScotlandCameras(): Promise<CctvCamera[]> {
  try {
    const res = await fetch('https://trafficscotland.org/cctv/cctv.xml', {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA, 'Accept': 'text/xml, application/xml' },
    });
    if (!res.ok) return SCOTLAND_FALLBACK;
    const xml = await res.text();
    const cams: CctvCamera[] = [];
    const itemRe = /<camera[^>]*>[\s\S]*?<\/camera>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[0];
      const get = (tag: string) => block.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() || '';
      const lat = parseFloat(get('latitude'));
      const lng = parseFloat(get('longitude'));
      if (isNaN(lat) || isNaN(lng)) continue;
      cams.push({ id: `scot-${cams.length}`, lat, lng, name: get('name') || 'Scotland Camera', city: 'Scotland', country: 'UK', feed_url: get('url') || '', source: 'Traffic Scotland' });
    }
    return cams.length > 0 ? cams : SCOTLAND_FALLBACK;
  } catch { return SCOTLAND_FALLBACK; }
}

const SCOTLAND_FALLBACK: CctvCamera[] = [
  { id: 'scot-1', lat: 55.8642, lng: -4.2518, name: 'Glasgow M8', city: 'Glasgow', country: 'UK', stream_url: 'https://www.youtube.com/embed/ioONrWVYkEE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Traffic Scotland' },
  { id: 'scot-2', lat: 55.9533, lng: -3.1883, name: 'Edinburgh City Centre', city: 'Edinburgh', country: 'UK', stream_url: 'https://www.youtube.com/embed/yP-LBxc3XBM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Traffic Scotland' },
  { id: 'scot-3', lat: 57.1497, lng: -2.0943, name: 'Aberdeen Harbour', city: 'Aberdeen', country: 'UK', stream_url: 'https://www.youtube.com/embed/GN0c9Jjn7K4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Traffic Scotland' },
];

// ── EarthCam public cameras (famous landmarks with public feeds) ──
export const EARTHCAM_CAMERAS: CctvCamera[] = [
  { id: 'ec-nyc-times-sq', lat: 40.7580, lng: -73.9855, name: 'Times Square, New York', city: 'New York', country: 'US', stream_url: 'https://www.youtube.com/embed/A_lhc8q1WGw?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/newyork/timessquare/', source: 'EarthCam' },
  { id: 'ec-chicago-navy', lat: 41.8919, lng: -87.6051, name: 'Chicago Navy Pier', city: 'Chicago', country: 'US', stream_url: 'https://www.youtube.com/embed/TVZrqtOGYig?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/illinois/chicago/', source: 'EarthCam' },
  { id: 'ec-vegas-strip', lat: 36.1146, lng: -115.1728, name: 'Las Vegas Strip', city: 'Las Vegas', country: 'US', stream_url: 'https://www.youtube.com/embed/0LhNdC3OPDY?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/nevada/lasvegas/', source: 'EarthCam' },
  { id: 'ec-niagara', lat: 43.0828, lng: -79.0742, name: 'Niagara Falls', city: 'Niagara Falls', country: 'Canada', stream_url: 'https://www.youtube.com/embed/9Bc0L6pFb_s?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/canada/ontario/niagarafalls/', source: 'EarthCam' },
  { id: 'ec-miami-beach', lat: 25.7907, lng: -80.1300, name: 'Miami South Beach', city: 'Miami', country: 'US', stream_url: 'https://www.youtube.com/embed/KH6dCqgZ9Sg?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/florida/miami/', source: 'EarthCam' },
  { id: 'ec-new-orleans', lat: 29.9584, lng: -90.0644, name: 'New Orleans Bourbon St', city: 'New Orleans', country: 'US', stream_url: 'https://www.youtube.com/embed/e8G8N3LiyXc?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/louisiana/neworleans/', source: 'EarthCam' },
  { id: 'ec-key-west', lat: 24.5551, lng: -81.7800, name: 'Key West Duval St', city: 'Key West', country: 'US', stream_url: 'https://www.youtube.com/embed/QFWbT7-gG4E?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/usa/florida/keywest/', source: 'EarthCam' },
  { id: 'ec-venice', lat: 45.4408, lng: 12.3155, name: 'Venice Grand Canal', city: 'Venice', country: 'Italy', stream_url: 'https://www.youtube.com/embed/vUKFkEiRxts?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/italy/venice/', source: 'EarthCam' },
  { id: 'ec-paris-eiffel', lat: 48.8584, lng: 2.2945, name: 'Paris Eiffel Tower', city: 'Paris', country: 'France', stream_url: 'https://www.youtube.com/embed/KKkNb_IBLMM?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/france/paris/', source: 'EarthCam' },
  { id: 'ec-rome-colosseum', lat: 41.8902, lng: 12.4922, name: 'Rome Colosseum', city: 'Rome', country: 'Italy', stream_url: 'https://www.youtube.com/embed/3C7j0cClHqU?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/italy/rome/', source: 'EarthCam' },
  { id: 'ec-dublin', lat: 53.3498, lng: -6.2603, name: 'Dublin Temple Bar', city: 'Dublin', country: 'Ireland', stream_url: 'https://www.youtube.com/embed/E6djI75Tpxo?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/ireland/dublin/', source: 'EarthCam' },
  { id: 'ec-sydney-opera', lat: -33.8568, lng: 151.2153, name: 'Sydney Opera House', city: 'Sydney', country: 'Australia', stream_url: 'https://www.youtube.com/embed/0R4ExdE8a9g?autoplay=1&mute=1', stream_type: 'iframe', external_url: 'https://www.earthcam.com/australia/sydney/', source: 'EarthCam' },
];

// ── Airport live cameras (major international airports) ──
export const AIRPORT_CAMERAS: CctvCamera[] = [
  // USA
  { id: 'apt-jfk', lat: 40.6413, lng: -73.7781, name: 'JFK International Airport', city: 'New York', country: 'US', stream_url: 'https://www.youtube.com/embed/jJSc-nkAOsw?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-lax', lat: 33.9425, lng: -118.4081, name: 'Los Angeles LAX', city: 'Los Angeles', country: 'US', stream_url: 'https://www.youtube.com/embed/NhFGx22bCrs?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-ord', lat: 41.9742, lng: -87.9073, name: "Chicago O'Hare Airport", city: 'Chicago', country: 'US', stream_url: 'https://www.youtube.com/embed/S3I-zMRQCOg?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-atl', lat: 33.6407, lng: -84.4277, name: 'Atlanta Hartsfield Airport', city: 'Atlanta', country: 'US', stream_url: 'https://www.youtube.com/embed/GMdlJjlCaSQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-dfw', lat: 32.8998, lng: -97.0403, name: 'Dallas Fort Worth Airport', city: 'Dallas', country: 'US', stream_url: 'https://www.youtube.com/embed/WlM1M0b0CXk?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  // Europe
  { id: 'apt-lhr', lat: 51.4700, lng: -0.4543, name: 'London Heathrow Airport', city: 'London', country: 'UK', stream_url: 'https://www.youtube.com/embed/u0BLMMJGtoo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-cdg', lat: 49.0097, lng: 2.5479, name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France', stream_url: 'https://www.youtube.com/embed/y7tz5l7cVys?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-fra', lat: 50.0379, lng: 8.5622, name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', stream_url: 'https://www.youtube.com/embed/7cLxGLUvF2k?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-ams', lat: 52.3105, lng: 4.7683, name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Netherlands', stream_url: 'https://www.youtube.com/embed/b5OP6-yFpb4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-mad', lat: 40.4983, lng: -3.5676, name: 'Madrid Barajas Airport', city: 'Madrid', country: 'Spain', stream_url: 'https://www.youtube.com/embed/K0TvI7r3RdQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  // Asia
  { id: 'apt-dxb', lat: 25.2532, lng: 55.3657, name: 'Dubai International Airport', city: 'Dubai', country: 'UAE', stream_url: 'https://www.youtube.com/embed/2Zhy_QWHF5U?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-sin', lat: 1.3644, lng: 103.9915, name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', stream_url: 'https://www.youtube.com/embed/NTnmH4G4oj4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-hnd', lat: 35.5494, lng: 139.7798, name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', stream_url: 'https://www.youtube.com/embed/OqIXbz9KLOA?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-icn', lat: 37.4602, lng: 126.4407, name: 'Seoul Incheon Airport', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/TLf2eT7pxOk?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-pek', lat: 40.0799, lng: 116.6031, name: 'Beijing Capital Airport', city: 'Beijing', country: 'China', stream_url: 'https://www.youtube.com/embed/s14EXxhbpno?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-bom', lat: 19.0896, lng: 72.8656, name: 'Mumbai Chhatrapati Shivaji Airport', city: 'Mumbai', country: 'India', stream_url: 'https://www.youtube.com/embed/VX0JbCl_8-8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  // Latin America
  { id: 'apt-gru', lat: -23.4356, lng: -46.4731, name: 'São Paulo Guarulhos Airport', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/pMTPbsEeMzw?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-mex', lat: 19.4363, lng: -99.0721, name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/fHAXUi40bRs?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  // Africa
  { id: 'apt-jnb', lat: -26.1392, lng: 28.2460, name: 'Johannesburg OR Tambo Airport', city: 'Johannesburg', country: 'South Africa', stream_url: 'https://www.youtube.com/embed/B3BkrCFBkOg?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
  { id: 'apt-cai', lat: 30.1219, lng: 31.4056, name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', stream_url: 'https://www.youtube.com/embed/dSjCcFaaxpA?autoplay=1&mute=1', stream_type: 'iframe', source: 'Airport Live' },
];

// ── Port/Harbor cameras ──
export const PORT_CAMERAS: CctvCamera[] = [
  { id: 'port-rotterdam', lat: 51.9000, lng: 4.5000, name: 'Port of Rotterdam (Maasvlakte)', city: 'Rotterdam', country: 'Netherlands', stream_url: 'https://www.youtube.com/embed/7YVdlGGvJpI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Port Rotterdam' },
  { id: 'port-hamburg', lat: 53.5460, lng: 9.9680, name: 'Port of Hamburg Webcam', city: 'Hamburg', country: 'Germany', stream_url: 'https://www.youtube.com/embed/9MSk2RiPBMM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Port Hamburg' },
  { id: 'port-singapore', lat: 1.2630, lng: 103.8200, name: 'Port of Singapore Tanjong Pagar', city: 'Singapore', country: 'Singapore', stream_url: 'https://www.youtube.com/embed/fEn9RvVOHRQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'MPA Singapore' },
  { id: 'port-shanghai', lat: 31.3230, lng: 121.8110, name: 'Port of Shanghai Yangshan', city: 'Shanghai', country: 'China', stream_url: 'https://www.youtube.com/embed/g_4lZqpqKbs?autoplay=1&mute=1', stream_type: 'iframe', source: 'Shanghai Port' },
  { id: 'port-los-angeles', lat: 33.7490, lng: -118.2720, name: 'Port of Los Angeles', city: 'Los Angeles', country: 'US', stream_url: 'https://www.youtube.com/embed/FI_3Rra4jkE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Port LA' },
  { id: 'port-antwerp', lat: 51.2500, lng: 4.3900, name: 'Port of Antwerp', city: 'Antwerp', country: 'Belgium', stream_url: 'https://www.youtube.com/embed/mNe-r8H5Kvg?autoplay=1&mute=1', stream_type: 'iframe', source: 'Port Antwerp' },
  { id: 'port-dubai', lat: 25.0190, lng: 55.0680, name: 'Port of Dubai Jebel Ali', city: 'Dubai', country: 'UAE', stream_url: 'https://www.youtube.com/embed/xN9DEcVaQ_4?autoplay=1&mute=1', stream_type: 'iframe', source: 'DP World' },
  { id: 'port-busan', lat: 35.0946, lng: 129.0444, name: 'Port of Busan North', city: 'Busan', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/YpidyxBWAzs?autoplay=1&mute=1', stream_type: 'iframe', source: 'BPA Busan' },
];

// ── Beach / Nature / Tourism cameras ──
export const BEACH_NATURE_CAMERAS: CctvCamera[] = [
  // European beaches
  { id: 'beach-barcelona', lat: 41.3851, lng: 2.1734, name: 'Barcelona Barceloneta Beach', city: 'Barcelona', country: 'Spain', stream_url: 'https://www.youtube.com/embed/fGIaIRblrb4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-nice', lat: 43.6959, lng: 7.2717, name: 'Nice Promenade des Anglais', city: 'Nice', country: 'France', stream_url: 'https://www.youtube.com/embed/A27o6BDN1wI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-dubrovnik', lat: 42.6507, lng: 18.0944, name: 'Dubrovnik Old Town', city: 'Dubrovnik', country: 'Croatia', stream_url: 'https://www.youtube.com/embed/E9VNsKXH1CE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-santorini', lat: 36.3932, lng: 25.4615, name: 'Santorini Oia', city: 'Santorini', country: 'Greece', stream_url: 'https://www.youtube.com/embed/qR_8YbD4f5s?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-mykonos', lat: 37.4467, lng: 25.3289, name: 'Mykonos Windmills', city: 'Mykonos', country: 'Greece', stream_url: 'https://www.youtube.com/embed/Fa0EqC3c2Q0?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-amalfi', lat: 40.6340, lng: 14.6027, name: 'Amalfi Coast', city: 'Amalfi', country: 'Italy', stream_url: 'https://www.youtube.com/embed/Hb0pGxPZvd8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  // Americas
  { id: 'beach-copacabana', lat: -22.9714, lng: -43.1823, name: 'Rio Copacabana Beach', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/T-CuD6OhKdM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-cancun', lat: 21.1619, lng: -86.8515, name: 'Cancún Hotel Zone Beach', city: 'Cancún', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/yJmxqMfV23E?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-waikiki', lat: 21.2793, lng: -157.8293, name: 'Waikiki Beach Hawaii', city: 'Honolulu', country: 'US', stream_url: 'https://www.youtube.com/embed/8X8VoJSmFvo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  // Asia Pacific
  { id: 'beach-phuket', lat: 7.8804, lng: 98.3923, name: 'Phuket Patong Beach', city: 'Phuket', country: 'Thailand', stream_url: 'https://www.youtube.com/embed/OtF5M7mgOa0?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-bali', lat: -8.7215, lng: 115.1693, name: 'Bali Seminyak Beach', city: 'Bali', country: 'Indonesia', stream_url: 'https://www.youtube.com/embed/7o7o8VtR6oI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  { id: 'beach-boracay', lat: 11.9674, lng: 121.9248, name: 'Boracay White Beach', city: 'Boracay', country: 'Philippines', stream_url: 'https://www.youtube.com/embed/jzJCRfNOzBE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Skyline Webcams' },
  // Nature
  { id: 'nature-niagara', lat: 43.0800, lng: -79.0750, name: 'Niagara Falls (Maid of the Mist)', city: 'Niagara Falls', country: 'Canada', stream_url: 'https://www.youtube.com/embed/9Bc0L6pFb_s?autoplay=1&mute=1', stream_type: 'iframe', source: 'Niagara Falls' },
  { id: 'nature-grand-canyon', lat: 36.0544, lng: -112.1401, name: 'Grand Canyon South Rim', city: 'Arizona', country: 'US', stream_url: 'https://www.youtube.com/embed/dR-tTxnAGQk?autoplay=1&mute=1', stream_type: 'iframe', source: 'NPS' },
  { id: 'nature-yellowstone', lat: 44.4280, lng: -110.5885, name: 'Yellowstone Old Faithful', city: 'Wyoming', country: 'US', stream_url: 'https://www.youtube.com/embed/ePsB3Z6L_6g?autoplay=1&mute=1', stream_type: 'iframe', source: 'NPS' },
  { id: 'nature-aurora-norway', lat: 69.6496, lng: 18.9560, name: 'Northern Lights - Tromsø', city: 'Tromsø', country: 'Norway', stream_url: 'https://www.youtube.com/embed/6_jqJoq8GqI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Aurora Borealis' },
  { id: 'nature-mount-fuji', lat: 35.3606, lng: 138.7278, name: 'Mount Fuji Live View', city: 'Fujiyoshida', country: 'Japan', stream_url: 'https://www.youtube.com/embed/pfRy0UwrCiI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Japan Tourism' },
  { id: 'nature-everest-bc', lat: 28.0050, lng: 86.8526, name: 'Mount Everest Base Camp', city: 'Khumbu', country: 'Nepal', stream_url: 'https://www.youtube.com/embed/iMX8blHqSU8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Himalayan Webcam' },
];

// ── More US state DOT cameras ──
export async function fetchMoreUSCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];

  // Nevada DOT (NvRoads)
  try {
    const data = await tryFetch('https://nvroads.com/api/v2/get/cameras');
    for (const c of (data || [])) {
      if (!c.latitude || !c.longitude) continue;
      cams.push({ id: `nv-${c.id || cams.length}`, lat: c.latitude, lng: c.longitude, name: c.name || 'NvRoads Camera', city: 'Nevada', country: 'US', feed_url: c.imageUrl || '', source: 'Nevada DOT' });
    }
  } catch { /* silent */ }

  // North Carolina DOT
  try {
    const data = await tryFetch('https://tims.ncdot.gov/tims/api/Cameras');
    for (const c of (Array.isArray(data) ? data : data?.cameras || [])) {
      if (!c.Latitude || !c.Longitude) continue;
      cams.push({ id: `nc-${c.Id || cams.length}`, lat: c.Latitude, lng: c.Longitude, name: c.Name || 'NCDOT Camera', city: 'North Carolina', country: 'US', feed_url: c.ImageURL || '', source: 'NCDOT' });
    }
  } catch { /* silent */ }

  // Tennessee 511
  try {
    const data = await tryFetch('https://tn511.com/api/v2/get/cameras');
    for (const c of (data || [])) {
      if (!c.latitude || !c.longitude) continue;
      cams.push({ id: `tn-${c.id || cams.length}`, lat: c.latitude, lng: c.longitude, name: c.description || 'TN Camera', city: 'Tennessee', country: 'US', feed_url: c.imageUrl || '', source: '511 Tennessee' });
    }
  } catch { /* silent */ }

  return cams.filter(c => c.lat && c.lng);
}

// ── Seoul CCTV (South Korea public feeds) ──
export const SEOUL_CAMERAS: CctvCamera[] = [
  { id: 'kr-seoul-1', lat: 37.5665, lng: 126.9780, name: 'Seoul Gwanghwamun Square', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/fwDW-S3tFVo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Seoul City' },
  { id: 'kr-seoul-2', lat: 37.5798, lng: 126.9770, name: 'Seoul Bukchon Hanok Village', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/BTgE3cCm8X0?autoplay=1&mute=1', stream_type: 'iframe', source: 'Seoul Tourism' },
  { id: 'kr-seoul-3', lat: 37.5700, lng: 126.9770, name: 'Seoul Gyeongbokgung Palace', city: 'Seoul', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/U1mYbsGHaqE?autoplay=1&mute=1', stream_type: 'iframe', source: 'KTO' },
  { id: 'kr-busan-1', lat: 35.1796, lng: 129.0756, name: 'Busan Haeundae Beach', city: 'Busan', country: 'South Korea', stream_url: 'https://www.youtube.com/embed/vlFX5NPIBHI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Busan Tourism' },
];

// ── Japan public cameras ──
export const JAPAN_MORE_CAMERAS: CctvCamera[] = [
  { id: 'jp-shibuya', lat: 35.6580, lng: 139.7016, name: 'Tokyo Shibuya Crossing', city: 'Tokyo', country: 'Japan', stream_url: 'https://www.youtube.com/embed/C5DSi_aKMaI?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'jp-akihabara', lat: 35.6986, lng: 139.7730, name: 'Tokyo Akihabara', city: 'Tokyo', country: 'Japan', stream_url: 'https://www.youtube.com/embed/v3LXlENy2YU?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'jp-shinjuku', lat: 35.6896, lng: 139.6917, name: 'Tokyo Shinjuku', city: 'Tokyo', country: 'Japan', stream_url: 'https://www.youtube.com/embed/C7IFx7FwSU0?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'jp-kyoto', lat: 35.0116, lng: 135.7681, name: 'Kyoto Kinkakuji Temple', city: 'Kyoto', country: 'Japan', stream_url: 'https://www.youtube.com/embed/U8Y5yBDfpTI?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'jp-osaka', lat: 34.7024, lng: 135.5061, name: 'Osaka Dotonbori', city: 'Osaka', country: 'Japan', stream_url: 'https://www.youtube.com/embed/kj9GrAI2BIs?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'jp-hokkaido', lat: 43.0618, lng: 141.3545, name: 'Sapporo Odori Park', city: 'Sapporo', country: 'Japan', stream_url: 'https://www.youtube.com/embed/rxekfx8RNt4?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Middle East expanded ──
export const MIDEAST_MORE_CAMERAS: CctvCamera[] = [
  { id: 'me-istanbul-1', lat: 41.0082, lng: 28.9784, name: 'Istanbul Bosphorus Bridge', city: 'Istanbul', country: 'Turkey', stream_url: 'https://www.youtube.com/embed/LbZODp5zRSY?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'me-istanbul-2', lat: 41.0054, lng: 28.9768, name: 'Istanbul Grand Bazaar', city: 'Istanbul', country: 'Turkey', stream_url: 'https://www.youtube.com/embed/mNEpCHlPPBo?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'me-amman-1', lat: 31.9539, lng: 35.9106, name: 'Amman City Centre', city: 'Amman', country: 'Jordan', stream_url: 'https://www.youtube.com/embed/f2hpVrgD1XM?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'me-beirut-1', lat: 33.8886, lng: 35.4955, name: 'Beirut Downtown', city: 'Beirut', country: 'Lebanon', stream_url: 'https://www.youtube.com/embed/gOFUbKw1vOc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  { id: 'me-doha-1', lat: 25.2854, lng: 51.5310, name: 'Doha Corniche', city: 'Doha', country: 'Qatar', stream_url: 'https://www.youtube.com/embed/4Y2iocSzQ8Q?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
];

// ── Aggregate all new sources ──
export async function fetchAllMoreCameras(): Promise<CctvCamera[]> {
  const [ukHighway, scotland, usMore] = await Promise.allSettled([
    fetchUKHighwayCameras(),
    fetchScotlandCameras(),
    fetchMoreUSCameras(),
  ]);

  return [
    ...(ukHighway.status === 'fulfilled' ? ukHighway.value : UK_HIGHWAY_FALLBACK),
    ...(scotland.status === 'fulfilled' ? scotland.value : SCOTLAND_FALLBACK),
    ...(usMore.status === 'fulfilled' ? usMore.value : []),
    ...EARTHCAM_CAMERAS,
    ...AIRPORT_CAMERAS,
    ...PORT_CAMERAS,
    ...BEACH_NATURE_CAMERAS,
    ...SEOUL_CAMERAS,
    ...JAPAN_MORE_CAMERAS,
    ...MIDEAST_MORE_CAMERAS,
  ].filter(c => c.lat && c.lng);
}
