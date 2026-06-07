import type { CctvCamera } from './types';

const TEXAS_STATIC: CctvCamera[] = [
  { id: 'tx-0', lat: 29.7604, lng: -95.3698, name: 'Houston - I-10 & I-45', city: 'Houston', country: 'US', feed_url: 'https://www.houstontranstar.org/road_conditions/cameras/displayimage.aspx?imageid=1', source: 'TxDOT' },
  { id: 'tx-1', lat: 29.7631, lng: -95.3631, name: 'Houston - US-59 @ Travis', city: 'Houston', country: 'US', feed_url: 'https://www.houstontranstar.org/road_conditions/cameras/displayimage.aspx?imageid=2', source: 'TxDOT' },
  { id: 'tx-2', lat: 32.7767, lng: -96.7970, name: 'Dallas - I-35E & I-30', city: 'Dallas', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/1', source: 'TxDOT' },
  { id: 'tx-3', lat: 32.7897, lng: -96.8007, name: 'Dallas - Woodall Rodgers', city: 'Dallas', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/2', source: 'TxDOT' },
  { id: 'tx-4', lat: 30.2672, lng: -97.7431, name: 'Austin - I-35 Downtown', city: 'Austin', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/10', source: 'TxDOT' },
  { id: 'tx-5', lat: 30.2500, lng: -97.8330, name: 'Austin - MoPac Expressway', city: 'Austin', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/11', source: 'TxDOT' },
  { id: 'tx-6', lat: 29.4241, lng: -98.4936, name: 'San Antonio - I-35 & Loop 410', city: 'San Antonio', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/20', source: 'TxDOT' },
  { id: 'tx-7', lat: 29.4500, lng: -98.5011, name: 'San Antonio - US-281 N', city: 'San Antonio', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/21', source: 'TxDOT' },
  { id: 'tx-8', lat: 32.7257, lng: -97.3208, name: 'Fort Worth - I-30 & Loop 820', city: 'Fort Worth', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/30', source: 'TxDOT' },
  { id: 'tx-9', lat: 29.8800, lng: -97.9400, name: 'Kyle - I-35 @ FM 150', city: 'Kyle', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/40', source: 'TxDOT' },
  { id: 'tx-10', lat: 30.3522, lng: -97.7553, name: 'Austin - I-35 & US-183', city: 'Austin', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/12', source: 'TxDOT' },
  { id: 'tx-11', lat: 32.9200, lng: -96.9700, name: 'Irving - SH-114 @ SH-183', city: 'Irving', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/50', source: 'TxDOT' },
  { id: 'tx-12', lat: 33.0198, lng: -97.2897, name: 'Keller - US-377', city: 'Keller', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/51', source: 'TxDOT' },
  { id: 'tx-13', lat: 29.7010, lng: -95.4200, name: 'Houston - I-69 @ BW-8', city: 'Houston', country: 'US', feed_url: 'https://www.houstontranstar.org/road_conditions/cameras/displayimage.aspx?imageid=3', source: 'TxDOT' },
  { id: 'tx-14', lat: 30.6280, lng: -96.3344, name: 'Bryan/College Station - TX-6', city: 'Bryan', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/60', source: 'TxDOT' },
  { id: 'tx-15', lat: 28.0000, lng: -97.3961, name: 'Corpus Christi - I-37', city: 'Corpus Christi', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/70', source: 'TxDOT' },
  { id: 'tx-16', lat: 31.7619, lng: -106.4850, name: 'El Paso - I-10 Downtown', city: 'El Paso', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/80', source: 'TxDOT' },
  { id: 'tx-17', lat: 26.2034, lng: -98.2300, name: 'McAllen - US-83', city: 'McAllen', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/90', source: 'TxDOT' },
  { id: 'tx-18', lat: 30.0800, lng: -94.1302, name: 'Beaumont - I-10 @ US-69', city: 'Beaumont', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/100', source: 'TxDOT' },
  { id: 'tx-19', lat: 33.5779, lng: -101.8552, name: 'Lubbock - US-87', city: 'Lubbock', country: 'US', feed_url: 'https://www.drivetexas.org/image/camera/110', source: 'TxDOT' },
];

export async function fetchTexasCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://511.txdot.gov/api/v2/cameras', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return TEXAS_STATIC;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cameras || []);
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.latitude || cam.lat);
      const lng = parseFloat(cam.longitude || cam.lng);
      if (!lat || !lng) continue;
      cams.push({
        id: `tx-api-${i}`,
        lat,
        lng,
        name: cam.displayName || cam.name || cam.description || `TX Camera ${i}`,
        city: cam.city || cam.county || 'Texas',
        country: 'US',
        feed_url: cam.imageUrl || cam.url || undefined,
        source: 'TxDOT',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : TEXAS_STATIC;
  } catch { return TEXAS_STATIC; }
}
