import { NextResponse } from 'next/server';
import { getShodanKey } from '@/lib/shodanKeys';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Global Internet Device Exposure Heatmap
 *
 * Uses Shodan COUNT + FACETS endpoint (OSS plan — no search credits used).
 * Returns country-level device counts for multiple threat categories.
 * Each query uses a rotating Shodan API key.
 *
 * Device categories:
 * - IP Cameras (Hikvision/Dahua/Axis) — 2.8M+ globally
 * - RTSP streams — 2.5M+ globally
 * - Exposed web interfaces — millions
 * - Industrial control systems
 * - Medical devices (DICOM)
 * - Routers/infrastructure
 */

// Country ISO-2 → [lat, lng] centroids
const CC_TO_COORDS: Record<string, [number, number]> = {
  AF:[-33.87,25.62],AG:[17.12,-61.85],AI:[18.22,-63.07],AL:[41.15,20.17],AM:[40.07,45.04],
  AN:[12.23,-69.06],AO:[-11.20,17.87],AQ:[-90.00,0.00],AR:[-38.42,-63.62],AT:[47.52,14.55],
  AU:[-25.27,133.78],AW:[12.52,-69.98],AZ:[40.14,47.58],BA:[44.16,17.68],BB:[13.19,-59.54],
  BD:[23.68,90.36],BE:[50.50,4.47],BF:[12.36,-1.56],BG:[42.73,25.49],BH:[26.02,50.55],
  BI:[-3.37,29.92],BJ:[9.31,2.32],BN:[4.94,114.94],BO:[-16.29,-63.59],BR:[-14.24,-51.93],
  BS:[24.77,-77.99],BT:[27.51,90.43],BW:[-22.33,24.68],BY:[53.71,27.95],BZ:[17.19,-88.50],
  CA:[56.13,-106.35],CD:[-4.04,21.76],CF:[6.61,20.94],CG:[-0.23,15.83],CH:[46.82,8.23],
  CI:[7.54,-5.55],CL:[-35.68,-71.54],CM:[3.85,11.50],CN:[35.86,104.20],CO:[4.57,-74.30],
  CR:[9.75,-83.75],CU:[21.52,-77.78],CV:[16.54,-23.04],CY:[35.13,33.43],CZ:[49.82,15.47],
  DE:[51.17,10.45],DJ:[11.83,42.59],DK:[56.26,9.50],DO:[18.74,-70.17],DZ:[28.03,1.66],
  EC:[-1.83,-78.18],EE:[58.60,25.01],EG:[26.82,30.80],ER:[15.18,39.78],ES:[40.46,-3.75],
  ET:[9.15,40.49],FI:[61.92,25.75],FJ:[-17.71,178.06],FR:[46.23,2.21],GA:[-0.80,11.61],
  GB:[55.38,-3.44],GE:[42.32,43.36],GH:[7.95,-1.02],GM:[13.44,-15.31],GN:[11.00,-10.90],
  GQ:[1.65,10.27],GR:[39.07,21.82],GT:[15.78,-90.23],GW:[11.80,-15.18],GY:[4.86,-58.93],
  HN:[15.20,-86.24],HR:[45.10,15.20],HT:[18.97,-72.29],HU:[47.16,19.50],ID:[-0.79,113.92],
  IE:[53.41,-8.24],IL:[31.05,34.85],IN:[20.59,78.96],IQ:[33.22,43.68],IR:[32.43,53.69],
  IS:[64.96,-19.02],IT:[41.87,12.57],JM:[18.11,-77.30],JO:[30.59,36.24],JP:[36.20,138.25],
  KE:[-0.02,37.91],KG:[41.20,74.76],KH:[12.57,104.99],KI:[1.42,173.01],KM:[-11.64,43.33],
  KN:[17.36,-62.78],KP:[40.34,127.51],KR:[35.91,127.77],KW:[29.31,47.48],KZ:[48.02,66.92],
  LA:[19.86,102.50],LB:[33.85,35.86],LC:[13.91,-60.98],LI:[47.14,9.55],LK:[7.87,80.77],
  LR:[6.43,-9.43],LS:[-29.61,28.23],LT:[55.17,23.88],LU:[49.82,6.13],LV:[56.88,24.60],
  LY:[26.34,17.23],MA:[31.79,-7.09],MC:[43.73,7.40],MD:[47.41,28.37],ME:[42.71,19.37],
  MG:[-18.77,46.87],MK:[41.61,21.75],ML:[17.57,-3.99],MM:[21.92,95.96],MN:[46.86,103.85],
  MR:[21.01,-10.94],MT:[35.94,14.38],MU:[-20.35,57.55],MV:[3.20,73.22],MW:[-13.25,34.30],
  MX:[23.63,-102.55],MY:[4.21,101.98],MZ:[-18.67,35.53],NA:[-22.96,18.49],NE:[17.61,8.08],
  NG:[9.08,8.68],NI:[12.87,-85.21],NL:[52.13,5.29],NO:[60.47,8.47],NP:[28.39,84.12],
  NR:[-0.52,166.93],NZ:[-40.90,174.89],OM:[21.51,55.92],PA:[8.54,-80.78],PE:[-9.19,-75.02],
  PF:[-17.68,-149.41],PG:[-6.31,143.96],PH:[12.88,121.77],PK:[30.38,69.35],PL:[51.92,19.15],
  PR:[18.22,-66.59],PS:[31.95,35.23],PT:[39.40,-8.22],PW:[7.52,134.58],PY:[-23.44,-58.44],
  QA:[25.35,51.18],RO:[45.94,24.97],RS:[44.02,21.01],RU:[61.52,105.32],RW:[-1.94,29.87],
  SA:[23.89,45.08],SB:[-9.64,160.16],SD:[12.86,30.22],SE:[60.13,18.64],SG:[1.35,103.82],
  SI:[46.15,14.99],SK:[48.67,19.70],SL:[8.46,-11.78],SN:[14.50,-14.45],SO:[5.15,46.20],
  SR:[3.92,-56.03],SS:[6.88,31.57],ST:[0.19,6.61],SV:[13.79,-88.90],SY:[34.80,38.99],
  SZ:[-26.52,31.47],TD:[15.45,18.73],TG:[8.62,0.82],TH:[15.87,100.99],TJ:[38.86,71.28],
  TL:[-8.87,125.73],TM:[38.97,59.56],TN:[33.89,9.54],TO:[-21.18,-175.20],TR:[38.96,35.24],
  TT:[10.69,-61.22],TV:[-7.11,177.64],TW:[23.70,120.96],TZ:[-6.37,34.89],UA:[48.38,31.17],
  UG:[1.37,32.29],US:[37.09,-95.71],UY:[-32.52,-55.76],UZ:[41.38,64.59],VA:[41.90,12.45],
  VC:[12.98,-61.29],VE:[6.42,-66.59],VN:[14.06,108.28],VU:[-15.38,166.96],WS:[-13.76,-172.10],
  YE:[15.55,48.52],ZA:[-30.56,22.94],ZM:[-13.13,27.85],ZW:[-19.02,29.15],
  HK:[22.32,114.17],MO:[22.19,113.54],TF:[-49.28,69.35],
};

interface DeviceCategory {
  id: string;
  label: string;
  query: string;
  color: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
}

// Device categories queried from Shodan — each uses one rotating key
const DEVICE_CATEGORIES: DeviceCategory[] = [
  { id: 'ip_cameras', label: 'IP Cameras (Hikvision/Dahua/Axis)', query: 'Hikvision OR Dahua OR Axis', color: '#39FF14', severity: 'high' },
  { id: 'rtsp_streams', label: 'RTSP Video Streams', query: 'port:554 rtsp', color: '#00E5FF', severity: 'high' },
  { id: 'exposed_rdp', label: 'Exposed Remote Desktop (RDP)', query: 'port:3389', color: '#FF1744', severity: 'critical' },
  { id: 'exposed_smb', label: 'Exposed SMB/File Shares', query: 'port:445 product:samba OR product:windows', color: '#FF6B00', severity: 'critical' },
  { id: 'industrial_ics', label: 'Industrial Control Systems', query: 'port:502 OR port:20000 OR port:47808', color: '#FF9500', severity: 'critical' },
  { id: 'open_databases', label: 'Open Databases (MongoDB/Redis/Elastic)', query: 'port:27017 OR port:6379 OR port:9200', color: '#E040FB', severity: 'critical' },
  { id: 'exposed_printers', label: 'Network Printers', query: 'port:9100 product:printer OR product:jetdirect', color: '#FFD700', severity: 'medium' },
  { id: 'voip_devices', label: 'VoIP Systems (SIP)', query: 'port:5060 product:asterisk OR product:cisco', color: '#87CEEB', severity: 'medium' },
  { id: 'routers_switches', label: 'Routers & Network Infrastructure', query: 'product:"Cisco IOS" OR product:"MikroTik" OR product:"Juniper"', color: '#448AFF', severity: 'high' },
  { id: 'medical_devices', label: 'Medical Devices (DICOM)', query: 'port:104 DICOM', color: '#FF4081', severity: 'critical' },
];

let _cache: { devices: any[]; ts: number } | null = null;

async function queryShodan(category: DeviceCategory): Promise<any[]> {
  const key = getShodanKey();
  if (!key) return [];

  const url = `https://api.shodan.io/shodan/host/count?key=${key}&query=${encodeURIComponent(category.query)}&facets=country:200`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const countries: Array<{ value: string; count: number }> = data?.facets?.country || [];
    const total: number = data?.total || 0;

    return countries
      .filter(c => c.count > 10)
      .map(c => {
        const coords = CC_TO_COORDS[c.value.toUpperCase()];
        if (!coords) return null;
        return {
          id: `${category.id}-${c.value}`,
          country: c.value,
          lat: coords[0] + (Math.random() - 0.5) * 0.5, // slight jitter for density feel
          lng: coords[1] + (Math.random() - 0.5) * 0.5,
          count: c.count,
          category_id: category.id,
          category_label: category.label,
          color: category.color,
          severity: category.severity,
          total_in_category: total,
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.ts < 1800000) { // 30 min cache
    return NextResponse.json(
      { devices: _cache.devices, total: _cache.devices.length, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  }

  // Stagger requests to avoid hitting the same key simultaneously
  const allDevices: any[] = [];
  for (const category of DEVICE_CATEGORIES) {
    const devices = await queryShodan(category);
    allDevices.push(...devices);
    await new Promise(r => setTimeout(r, 200)); // 200ms between queries
  }

  _cache = { devices: allDevices, ts: now };

  return NextResponse.json(
    { devices: allDevices, total: allDevices.length, categories: DEVICE_CATEGORIES.map(c => ({ id: c.id, label: c.label, color: c.color })), timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
  );
}
