import type { CctvCamera } from './types';

const BRAZIL_STATIC: CctvCamera[] = [
  { id: 'br-0', lat: -23.5505, lng: -46.6333, name: 'São Paulo - Av. Paulista', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/y7OQ5RuPJx4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-1', lat: -23.5617, lng: -46.6560, name: 'São Paulo - Marginal Tietê', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/6bCfIHiAoYI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-2', lat: -23.6100, lng: -46.6964, name: 'São Paulo - Rodoanel Mario Covas', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/AHwVWHVkqfk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-3', lat: -23.4928, lng: -46.6262, name: 'São Paulo - Rodovia Anhanguera', city: 'São Paulo', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/9nCiXVJFBLU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-4', lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro - Copacabana', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/EkCSK5Eg6WU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-5', lat: -22.9716, lng: -43.1897, name: 'Rio de Janeiro - Linha Amarela', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/8zXBXWtCo3Y?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-6', lat: -22.8832, lng: -43.1045, name: 'Rio de Janeiro - Barra da Tijuca', city: 'Rio de Janeiro', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/dqDNX7E0DmI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-7', lat: -15.7801, lng: -47.9292, name: 'Brasília - Eixo Monumental', city: 'Brasília', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/cbJHXbxalxY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-8', lat: -15.7942, lng: -47.8825, name: 'Brasília - Plano Piloto', city: 'Brasília', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/mhA75JWQVBQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-9', lat: -19.9167, lng: -43.9345, name: 'Belo Horizonte - Av. Afonso Pena', city: 'Belo Horizonte', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/CaC5e7lq7dI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-10', lat: -12.9714, lng: -38.5014, name: 'Salvador - Pelourinho', city: 'Salvador', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/OlGG-N7fmBk?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-11', lat: -3.7172, lng: -38.5433, name: 'Fortaleza - Beira-Mar', city: 'Fortaleza', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/MHKV7OFVQOA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-12', lat: -8.0476, lng: -34.8770, name: 'Recife - Marco Zero', city: 'Recife', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/aFcG3-SCKU4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-13', lat: -30.0346, lng: -51.2177, name: 'Porto Alegre - Av. Beira-Rio', city: 'Porto Alegre', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/e1fX8LFDQNA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
  { id: 'br-14', lat: -25.4284, lng: -49.2733, name: 'Curitiba - Rua XV de Novembro', city: 'Curitiba', country: 'Brazil', stream_url: 'https://www.youtube.com/embed/d1DFfOSn3Rg?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'CET-SP / COR-Rio' },
];

export async function fetchBrazilCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch('https://cor.rio/api/cameras', {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return BRAZIL_STATIC;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data?.cameras || []);
    for (let i = 0; i < list.length; i++) {
      const cam = list[i];
      const lat = parseFloat(cam.latitude || cam.lat);
      const lng = parseFloat(cam.longitude || cam.lng);
      if (!lat || !lng) continue;
      cams.push({
        id: `br-cor-${i}`,
        lat,
        lng,
        name: cam.nome || cam.name || `Rio Camera ${i}`,
        city: 'Rio de Janeiro',
        country: 'Brazil',
        feed_url: cam.url || cam.imageUrl || undefined,
        source: 'CET-SP / COR-Rio',
      });
    }
    return [...cams.filter(c => c.lat && c.lng), ...BRAZIL_STATIC];
  } catch { return BRAZIL_STATIC; }
}
