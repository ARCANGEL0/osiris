import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KNOWN_VOLCANOES = [
  { id: 'etna', name: 'Etna', lat: 37.748, lng: 14.999, country: 'Italy', elevation_m: 3350, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Yellow' },
  { id: 'stromboli', name: 'Stromboli', lat: 38.789, lng: 15.213, country: 'Italy', elevation_m: 924, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Yellow' },
  { id: 'vesuvius', name: 'Vesuvius', lat: 40.821, lng: 14.426, country: 'Italy', elevation_m: 1281, type: 'Stratovolcano', activity_level: 'Dormant', alert_level: 'Green' },
  { id: 'campi-flegrei', name: 'Campi Flegrei', lat: 40.827, lng: 14.139, country: 'Italy', elevation_m: 458, type: 'Caldera', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'merapi', name: 'Merapi', lat: -7.542, lng: 110.442, country: 'Indonesia', elevation_m: 2930, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'semeru', name: 'Semeru', lat: -8.108, lng: 112.922, country: 'Indonesia', elevation_m: 3676, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'krakatau', name: 'Krakatau (Anak)', lat: -6.102, lng: 105.423, country: 'Indonesia', elevation_m: 338, type: 'Caldera', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'sinabung', name: 'Sinabung', lat: 3.170, lng: 98.392, country: 'Indonesia', elevation_m: 2460, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'pinatubo', name: 'Pinatubo', lat: 15.143, lng: 120.350, country: 'Philippines', elevation_m: 1486, type: 'Stratovolcano', activity_level: 'Dormant', alert_level: 'Green' },
  { id: 'mayon', name: 'Mayon', lat: 13.257, lng: 123.685, country: 'Philippines', elevation_m: 2463, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'taal', name: 'Taal', lat: 14.002, lng: 120.993, country: 'Philippines', elevation_m: 311, type: 'Caldera', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'popocatepetl', name: 'Popocatépetl', lat: 19.023, lng: -98.622, country: 'Mexico', elevation_m: 5426, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Yellow-Phase 3' },
  { id: 'colima', name: 'Colima', lat: 19.514, lng: -103.620, country: 'Mexico', elevation_m: 3850, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'kilauea', name: 'Kīlauea', lat: 19.421, lng: -155.287, country: 'USA', elevation_m: 1247, type: 'Shield', activity_level: 'Ongoing', alert_level: 'Watch' },
  { id: 'mauna-loa', name: 'Mauna Loa', lat: 19.475, lng: -155.608, country: 'USA', elevation_m: 4169, type: 'Shield', activity_level: 'Unrest', alert_level: 'Advisory' },
  { id: 'sakurajima', name: 'Sakurajima', lat: 31.585, lng: 130.657, country: 'Japan', elevation_m: 1117, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Level 3' },
  { id: 'aso', name: 'Aso', lat: 32.884, lng: 131.104, country: 'Japan', elevation_m: 1592, type: 'Caldera', activity_level: 'Unrest', alert_level: 'Level 2' },
  { id: 'sheveluch', name: 'Sheveluch', lat: 56.653, lng: 161.360, country: 'Russia', elevation_m: 3283, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'klyuchevskoy', name: 'Klyuchevskoy', lat: 56.057, lng: 160.638, country: 'Russia', elevation_m: 4835, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'erebus', name: 'Erebus', lat: -77.530, lng: 167.153, country: 'Antarctica', elevation_m: 3794, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Green' },
  { id: 'yasur', name: 'Yasur', lat: -19.532, lng: 169.447, country: 'Vanuatu', elevation_m: 361, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Level 2' },
  { id: 'nyiragongo', name: 'Nyiragongo', lat: -1.521, lng: 29.250, country: 'DR Congo', elevation_m: 3470, type: 'Stratovolcano', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'ol-doinyo-lengai', name: "Ol Doinyo Lengai", lat: -2.764, lng: 35.902, country: 'Tanzania', elevation_m: 2962, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'soufriere-hills', name: 'Soufrière Hills', lat: 16.716, lng: -62.177, country: 'Montserrat', elevation_m: 1050, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'la-palma', name: 'Cumbre Vieja (La Palma)', lat: 28.570, lng: -17.845, country: 'Spain', elevation_m: 1949, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Green' },
  { id: 'teide', name: 'Teide (Tenerife)', lat: 28.272, lng: -16.642, country: 'Spain', elevation_m: 3715, type: 'Stratovolcano', activity_level: 'Dormant', alert_level: 'Green' },
  { id: 'hekla', name: 'Hekla', lat: 63.983, lng: -19.666, country: 'Iceland', elevation_m: 1491, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Yellow' },
  { id: 'reykjanes', name: 'Reykjanes (Fagradalsfjall)', lat: 63.887, lng: -22.274, country: 'Iceland', elevation_m: 385, type: 'Shield', activity_level: 'Ongoing', alert_level: 'Orange' },
  { id: 'ruapehu', name: 'Ruapehu', lat: -39.281, lng: 175.568, country: 'New Zealand', elevation_m: 2797, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Level 1' },
  { id: 'cotopaxi', name: 'Cotopaxi', lat: -0.677, lng: -78.436, country: 'Ecuador', elevation_m: 5897, type: 'Stratovolcano', activity_level: 'Unrest', alert_level: 'Yellow' },
];

export async function GET() {
  try {
    // Try USGS Volcano Alerts
    const usgsRes = await fetch(
      'https://volcanoes.usgs.gov/vhp/products/json/val.json',
      { signal: AbortSignal.timeout(8000) }
    );

    if (usgsRes.ok) {
      const data = await usgsRes.json();
      const alerts: any[] = data?.volcanoes || data || [];
      if (Array.isArray(alerts) && alerts.length > 0) {
        const volcanoes = alerts.map((v: any, i: number) => ({
          id: `usgs-${v.id || i}`,
          name: v.vname || v.name || `Volcano ${i}`,
          lat: parseFloat(v.latitude || v.lat),
          lng: parseFloat(v.longitude || v.lng),
          country: v.country || 'Unknown',
          elevation_m: parseInt(v.elevation) || 0,
          type: v.type || 'Unknown',
          activity_level: v.activity_level || 'Unknown',
          alert_level: v.alertlevel || v.alert_level || 'Unknown',
          last_eruption: v.last_eruption || null,
          source: 'USGS VHP',
        })).filter((v: any) => v.lat && v.lng);

        if (volcanoes.length > 5) {
          return NextResponse.json({ volcanoes, total: volcanoes.length, timestamp: new Date().toISOString() }, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
          });
        }
      }
    }
  } catch { /* fall through to static */ }

  // Static fallback
  const volcanoes = KNOWN_VOLCANOES.map(v => ({ ...v, source: 'OSIRIS Static' }));
  return NextResponse.json({ volcanoes, total: volcanoes.length, timestamp: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
}
