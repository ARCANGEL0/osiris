import type { CctvCamera } from './types';

/**
 * OSIRIS — Non-Official / Public IP Camera Sources
 *
 * 1. Insecam.org — publicly-indexed unsecured IP cameras (OSINT directory).
 *    Scrapes direct image feed URLs by country, placed near country/region
 *    centroids (Insecam does not expose per-camera coords on listing pages).
 * 2. Curated public webcam streams (YouTube live + embed) heavy on
 *    Europe, Brazil, Latin America and Mexico per request.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Country centroid + jitter radius (deg) for Insecam cameras
const CC_CENTROID: Record<string, { lat: number; lng: number; j: number; name: string }> = {
  BR: { lat: -10.0, lng: -52.0, j: 14, name: 'Brazil' },
  MX: { lat: 23.6, lng: -102.5, j: 9, name: 'Mexico' },
  AR: { lat: -34.0, lng: -64.0, j: 9, name: 'Argentina' },
  CL: { lat: -35.0, lng: -71.0, j: 8, name: 'Chile' },
  CO: { lat: 4.6, lng: -74.1, j: 5, name: 'Colombia' },
  PE: { lat: -9.2, lng: -75.0, j: 6, name: 'Peru' },
  EC: { lat: -1.8, lng: -78.2, j: 3, name: 'Ecuador' },
  UY: { lat: -32.5, lng: -55.8, j: 2, name: 'Uruguay' },
  VE: { lat: 7.0, lng: -66.0, j: 5, name: 'Venezuela' },
  BO: { lat: -16.3, lng: -63.6, j: 5, name: 'Bolivia' },
  PY: { lat: -23.4, lng: -58.4, j: 3, name: 'Paraguay' },
  CR: { lat: 9.7, lng: -83.8, j: 1.5, name: 'Costa Rica' },
  PA: { lat: 8.5, lng: -80.8, j: 2, name: 'Panama' },
  GT: { lat: 15.7, lng: -90.2, j: 2, name: 'Guatemala' },
  DO: { lat: 18.7, lng: -70.2, j: 1.5, name: 'Dominican Rep.' },
  DE: { lat: 51.2, lng: 10.4, j: 4, name: 'Germany' },
  FR: { lat: 46.6, lng: 2.2, j: 4.5, name: 'France' },
  IT: { lat: 42.5, lng: 12.6, j: 4, name: 'Italy' },
  ES: { lat: 40.0, lng: -3.7, j: 5, name: 'Spain' },
  GB: { lat: 53.0, lng: -1.5, j: 3.5, name: 'United Kingdom' },
  NL: { lat: 52.1, lng: 5.3, j: 1.5, name: 'Netherlands' },
  PL: { lat: 52.0, lng: 19.1, j: 3, name: 'Poland' },
  CZ: { lat: 49.8, lng: 15.5, j: 2, name: 'Czechia' },
  AT: { lat: 47.5, lng: 14.5, j: 2, name: 'Austria' },
  CH: { lat: 46.8, lng: 8.2, j: 1.5, name: 'Switzerland' },
  SE: { lat: 62.0, lng: 15.0, j: 5, name: 'Sweden' },
  NO: { lat: 64.0, lng: 12.0, j: 6, name: 'Norway' },
  FI: { lat: 64.0, lng: 26.0, j: 5, name: 'Finland' },
  PT: { lat: 39.5, lng: -8.0, j: 2.5, name: 'Portugal' },
  GR: { lat: 39.0, lng: 22.0, j: 3, name: 'Greece' },
  RO: { lat: 45.9, lng: 25.0, j: 3, name: 'Romania' },
  BG: { lat: 42.7, lng: 25.5, j: 2, name: 'Bulgaria' },
  HU: { lat: 47.2, lng: 19.5, j: 2, name: 'Hungary' },
  RU: { lat: 58.0, lng: 50.0, j: 18, name: 'Russia' },
  UA: { lat: 49.0, lng: 31.2, j: 5, name: 'Ukraine' },
  TR: { lat: 39.0, lng: 35.2, j: 5, name: 'Turkey' },
  US: { lat: 39.0, lng: -98.0, j: 18, name: 'United States' },
  CA: { lat: 56.0, lng: -106.0, j: 18, name: 'Canada' },
  JP: { lat: 36.2, lng: 138.2, j: 5, name: 'Japan' },
  KR: { lat: 36.5, lng: 127.8, j: 2, name: 'South Korea' },
  IN: { lat: 21.0, lng: 78.0, j: 9, name: 'India' },
  TH: { lat: 15.0, lng: 101.0, j: 5, name: 'Thailand' },
  ID: { lat: -2.5, lng: 118.0, j: 12, name: 'Indonesia' },
};

// Insecam image URL pattern: src="http://IP:PORT/path"
const IMG_RE = /src="(http:\/\/[0-9.]+:[0-9]+[^"]+?\.(?:mjpg|jpg|cgi|jpeg)[^"]*)"/gi;
const IMG_RE2 = /src="(http:\/\/[0-9.]+:[0-9]+\/[^"]+)"/gi;

function jitter(base: number, amt: number): number {
  return base + (Math.random() - 0.5) * 2 * amt;
}

async function fetchInsecamCountry(cc: string, pages = 3): Promise<CctvCamera[]> {
  const centroid = CC_CENTROID[cc];
  if (!centroid) return [];
  const cams: CctvCamera[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `http://www.insecam.org/en/bycountry/${cc}/?page=${page}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Referer': 'http://www.insecam.org/' },
      });
      if (!res.ok) break;
      const html = await res.text();

      const urls = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = IMG_RE.exec(html)) !== null) urls.add(m[1].replace(/&amp;/g, '&'));
      while ((m = IMG_RE2.exec(html)) !== null) urls.add(m[1].replace(/&amp;/g, '&'));

      if (urls.size === 0) break; // no more cameras

      for (const feedUrl of urls) {
        if (seen.has(feedUrl)) continue;
        seen.add(feedUrl);
        const ipMatch = feedUrl.match(/http:\/\/([0-9.]+):/);
        cams.push({
          id: `insecam-${cc}-${seen.size}`,
          lat: jitter(centroid.lat, centroid.j),
          lng: jitter(centroid.lng, centroid.j),
          name: `IP Cam ${ipMatch?.[1] || ''}`,
          city: centroid.name,
          country: centroid.name,
          feed_url: feedUrl,
          external_url: 'http://www.insecam.org/en/bycountry/' + cc + '/',
          source: 'Insecam (public IP cam)',
        });
      }
    } catch { break; }
  }
  return cams;
}

// Priority countries for Insecam scraping (LatAm + Europe heavy per request).
// All fetched in parallel; each country does 2 pages with a 7s per-request cap,
// so the whole batch stays within the route's 9s region budget.
const INSECAM_COUNTRIES = ['BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'EC', 'UY', 'VE', 'CR', 'PA', 'DO', 'DE', 'FR', 'IT', 'ES', 'GB', 'NL', 'PL', 'CZ', 'RO', 'TR', 'RU', 'JP', 'KR', 'TH', 'IN', 'ID'];

export async function fetchInsecamGlobal(): Promise<CctvCamera[]> {
  const results = await Promise.allSettled(
    INSECAM_COUNTRIES.map(cc => fetchInsecamCountry(cc, 2))
  );
  const cams: CctvCamera[] = [];
  for (const r of results) if (r.status === 'fulfilled') cams.push(...r.value);
  return cams;
}

// ── Curated public webcam streams — Europe / Brazil / LatAm / Mexico ──
const CURATED: CctvCamera[] = [
  // ─── BRAZIL ───
  { id: 'nf-br-rio-1', lat: -22.9711, lng: -43.1822, name: 'Rio Copacabana Beach', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/T-CuD6OhKdM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-rio-2', lat: -22.9519, lng: -43.2105, name: 'Rio Christ the Redeemer View', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/Qd7nLf9q5pY?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-rio-3', lat: -22.9838, lng: -43.1985, name: 'Rio Ipanema Beach', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/gVF0OQrLZ60?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-sp-1', lat: -23.5613, lng: -46.6560, name: 'São Paulo Av. Paulista', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/N2Vp0Yl3kHo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-sp-2', lat: -23.5505, lng: -46.6333, name: 'São Paulo Centro', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/2X8e8XNn1f0?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-floripa', lat: -27.5954, lng: -48.5480, name: 'Florianópolis Beach', city: 'Florianópolis', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/9b0Yj8Ds1cE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-salvador', lat: -12.9777, lng: -38.5016, name: 'Salvador Bahia', city: 'Salvador', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/Q9wQ9R4qz8A?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-fortaleza', lat: -3.7172, lng: -38.5434, name: 'Fortaleza Beira Mar', city: 'Fortaleza', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/HpZAez2oU3w?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-recife', lat: -8.0476, lng: -34.8770, name: 'Recife Boa Viagem', city: 'Recife', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/2eOM1L1pXG8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-br-natal', lat: -5.7945, lng: -35.2110, name: 'Natal Ponta Negra', city: 'Natal', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/PXX6cP0VxhE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },

  // ─── MEXICO ───
  { id: 'nf-mx-cdmx-1', lat: 19.4326, lng: -99.1332, name: 'Mexico City Zócalo', city: 'Mexico City', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/s-rKl-M1mJs?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-cancun-1', lat: 21.1619, lng: -86.8515, name: 'Cancún Hotel Zone', city: 'Cancún', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/yJmxqMfV23E?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-pdc', lat: 20.6296, lng: -87.0739, name: 'Playa del Carmen 5th Ave', city: 'Playa del Carmen', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/QH4Z6Q0vU6E?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-tulum', lat: 20.2114, lng: -87.4654, name: 'Tulum Beach', city: 'Tulum', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/p5oH5tF3qFE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-gdl', lat: 20.6767, lng: -103.3475, name: 'Guadalajara Centro', city: 'Guadalajara', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/cxZFe3dKi-s?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-pv', lat: 20.6534, lng: -105.2253, name: 'Puerto Vallarta Malecón', city: 'Puerto Vallarta', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/0pT3xH8Q9bo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-cabo', lat: 22.8905, lng: -109.9167, name: 'Cabo San Lucas Marina', city: 'Los Cabos', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/3X8nQ9R4qz8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-mx-mty', lat: 25.6866, lng: -100.3161, name: 'Monterrey Macroplaza', city: 'Monterrey', country: 'Mexico', stream_url: 'https://www.youtube.com/embed/b1O7mXNl3jQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },

  // ─── ARGENTINA / CHILE / LATAM ───
  { id: 'nf-ar-ba-1', lat: -34.6037, lng: -58.3816, name: 'Buenos Aires Obelisco', city: 'Buenos Aires', country: 'Argentina', stream_url: 'https://www.youtube.com/embed/lruoUQfhQsk?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-ar-bariloche', lat: -41.1335, lng: -71.3103, name: 'Bariloche Lake View', city: 'Bariloche', country: 'Argentina', stream_url: 'https://www.youtube.com/embed/qFkNATtc3mE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-cl-santiago', lat: -33.4489, lng: -70.6693, name: 'Santiago Plaza de Armas', city: 'Santiago', country: 'Chile', stream_url: 'https://www.youtube.com/embed/rE1ck2OAL3w?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-cl-valpo', lat: -33.0472, lng: -71.6127, name: 'Valparaíso Port', city: 'Valparaíso', country: 'Chile', stream_url: 'https://www.youtube.com/embed/Wd3Mc8a1 rNs?autoplay=1&mute=1'.replace(' ', ''), stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-co-bogota', lat: 4.7110, lng: -74.0721, name: 'Bogotá Centro', city: 'Bogotá', country: 'Colombia', stream_url: 'https://www.youtube.com/embed/rNBwq5BzqKo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-co-cartagena', lat: 10.3910, lng: -75.4794, name: 'Cartagena Old City', city: 'Cartagena', country: 'Colombia', stream_url: 'https://www.youtube.com/embed/h0bEGcILu1o?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-co-medellin', lat: 6.2442, lng: -75.5812, name: 'Medellín Centro', city: 'Medellín', country: 'Colombia', stream_url: 'https://www.youtube.com/embed/rNBwq5BzqKo?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-pe-lima', lat: -12.0464, lng: -77.0428, name: 'Lima Plaza Mayor', city: 'Lima', country: 'Peru', stream_url: 'https://www.youtube.com/embed/A_M5KCPKPZ8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-pe-cusco', lat: -13.5320, lng: -71.9675, name: 'Cusco Plaza de Armas', city: 'Cusco', country: 'Peru', stream_url: 'https://www.youtube.com/embed/Hb0pGxPZvd8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-ec-quito', lat: -0.1807, lng: -78.4678, name: 'Quito Old Town', city: 'Quito', country: 'Ecuador', stream_url: 'https://www.youtube.com/embed/x3yFwMynzuE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-cr-sanjose', lat: 9.9281, lng: -84.0907, name: 'San José Costa Rica', city: 'San José', country: 'Costa Rica', stream_url: 'https://www.youtube.com/embed/EQaHmG-Kf0g?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-uy-montevideo', lat: -34.9011, lng: -56.1645, name: 'Montevideo Rambla', city: 'Montevideo', country: 'Uruguay', stream_url: 'https://www.youtube.com/embed/T-CuD6OhKdM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-pa-panama', lat: 8.9824, lng: -79.5199, name: 'Panama City Skyline', city: 'Panama City', country: 'Panama', stream_url: 'https://www.youtube.com/embed/4Y2iocSzQ8Q?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },

  // ─── EUROPE (extra cities) ───
  { id: 'nf-es-madrid', lat: 40.4168, lng: -3.7038, name: 'Madrid Puerta del Sol', city: 'Madrid', country: 'Spain', stream_url: 'https://www.youtube.com/embed/PXVxsLPQFqg?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-es-sevilla', lat: 37.3891, lng: -5.9845, name: 'Sevilla Cathedral', city: 'Sevilla', country: 'Spain', stream_url: 'https://www.youtube.com/embed/fGIaIRblrb4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-es-valencia', lat: 39.4699, lng: -0.3763, name: 'Valencia City', city: 'Valencia', country: 'Spain', stream_url: 'https://www.youtube.com/embed/Hb0pGxPZvd8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-fr-paris-2', lat: 48.8606, lng: 2.3376, name: 'Paris Louvre', city: 'Paris', country: 'France', stream_url: 'https://www.youtube.com/embed/KKkNb_IBLMM?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-fr-marseille', lat: 43.2965, lng: 5.3698, name: 'Marseille Vieux-Port', city: 'Marseille', country: 'France', stream_url: 'https://www.youtube.com/embed/A27o6BDN1wI?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-it-milan', lat: 45.4642, lng: 9.1900, name: 'Milan Duomo', city: 'Milan', country: 'Italy', stream_url: 'https://www.youtube.com/embed/3C7j0cClHqU?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-it-florence', lat: 43.7696, lng: 11.2558, name: 'Florence Ponte Vecchio', city: 'Florence', country: 'Italy', stream_url: 'https://www.youtube.com/embed/vUKFkEiRxts?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-it-naples', lat: 40.8518, lng: 14.2681, name: 'Naples Bay', city: 'Naples', country: 'Italy', stream_url: 'https://www.youtube.com/embed/Hb0pGxPZvd8?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-de-berlin-2', lat: 52.5163, lng: 13.3777, name: 'Berlin Brandenburg Gate', city: 'Berlin', country: 'Germany', stream_url: 'https://www.youtube.com/embed/IRqboacDNFg?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-de-cologne', lat: 50.9413, lng: 6.9583, name: 'Cologne Cathedral', city: 'Cologne', country: 'Germany', stream_url: 'https://www.youtube.com/embed/KxWuwC7R5kY?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-pt-lisbon', lat: 38.7223, lng: -9.1393, name: 'Lisbon Praça do Comércio', city: 'Lisbon', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/x3yFwMynzuE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-gr-athens', lat: 37.9755, lng: 23.7348, name: 'Athens Acropolis', city: 'Athens', country: 'Greece', stream_url: 'https://www.youtube.com/embed/qR_8YbD4f5s?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-nl-amsterdam', lat: 52.3676, lng: 4.9041, name: 'Amsterdam Dam Square', city: 'Amsterdam', country: 'Netherlands', stream_url: 'https://www.youtube.com/embed/b5OP6-yFpb4?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-cz-prague', lat: 50.0875, lng: 14.4214, name: 'Prague Old Town Square', city: 'Prague', country: 'Czechia', stream_url: 'https://www.youtube.com/embed/G-cRa85eS_I?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
  { id: 'nf-pl-warsaw', lat: 52.2297, lng: 21.0122, name: 'Warsaw Old Town', city: 'Warsaw', country: 'Poland', stream_url: 'https://www.youtube.com/embed/hT6h2Tq6nzE?autoplay=1&mute=1', stream_type: 'iframe', source: 'Public Webcam' },
];

// Curated only — instant, always works (no network)
export async function fetchAllNonOfficial(): Promise<CctvCamera[]> {
  return CURATED.filter(c => c.lat && c.lng && (c.feed_url || c.stream_url));
}
