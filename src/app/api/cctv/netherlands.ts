import type { CctvCamera } from './types';

const NL_STATIC: CctvCamera[] = [
  { id: 'nl-s-1', lat: 52.3676, lng: 4.9041, name: 'Amsterdam - A10 Ring', city: 'Amsterdam', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a10-amsterdam-west', source: 'RWS / NDW' },
  { id: 'nl-s-2', lat: 51.9225, lng: 4.4792, name: 'Rotterdam - Maastunnel', city: 'Rotterdam', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/maastunnel-rotterdam', source: 'RWS / NDW' },
  { id: 'nl-s-3', lat: 52.0705, lng: 4.3007, name: 'Den Haag - A4', city: 'Den Haag', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a4-den-haag', source: 'RWS / NDW' },
  { id: 'nl-s-4', lat: 52.0907, lng: 5.1214, name: 'Utrecht - A2', city: 'Utrecht', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a2-utrecht', source: 'RWS / NDW' },
  { id: 'nl-s-5', lat: 51.4416, lng: 5.4697, name: 'Eindhoven - A2/A67', city: 'Eindhoven', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a2-eindhoven', source: 'RWS / NDW' },
  { id: 'nl-s-6', lat: 51.8126, lng: 5.8372, name: 'Nijmegen - A73', city: 'Nijmegen', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a73-nijmegen', source: 'RWS / NDW' },
  { id: 'nl-s-7', lat: 53.2194, lng: 6.5665, name: 'Groningen - A7', city: 'Groningen', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a7-groningen', source: 'RWS / NDW' },
  { id: 'nl-s-8', lat: 52.5168, lng: 6.0830, name: 'Zwolle - A28', city: 'Zwolle', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a28-zwolle', source: 'RWS / NDW' },
  { id: 'nl-s-9', lat: 51.5719, lng: 4.7683, name: 'Breda - A16', city: 'Breda', country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a16-breda', source: 'RWS / NDW' },
  { id: 'nl-s-10', lat: 51.6978, lng: 5.3037, name: "'s-Hertogenbosch - A2", city: "'s-Hertogenbosch", country: 'Netherlands', feed_url: 'https://webcam.tcs.nl/a2-den-bosch', source: 'RWS / NDW' },
];

export async function fetchNetherlandsCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://opendata.ndw.nu/cameras.geojson', {
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept': 'application/geo+json' },
    });
    if (!res.ok) return NL_STATIC;
    const data = await res.json();
    const features: any[] = data?.features || [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const coords: number[] = f.geometry?.coordinates || [];
      if (coords.length < 2) continue;
      cams.push({
        id: `nl-${i}`,
        lat: coords[1],
        lng: coords[0],
        name: f.properties?.name || `NDW Camera ${i}`,
        city: 'Netherlands',
        country: 'Netherlands',
        feed_url: f.properties?.imageUrl || undefined,
        source: 'RWS / NDW',
      });
    }
    return cams.filter(c => c.lat && c.lng).length > 0
      ? cams.filter(c => c.lat && c.lng)
      : NL_STATIC;
  } catch { return NL_STATIC; }
}
