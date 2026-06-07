import type { CctvCamera } from './types';

const SWITZERLAND_STATIC: CctvCamera[] = [
  { id: 'ch-0', lat: 47.3769, lng: 8.5417, name: 'Zürich - Limmatquai', city: 'Zürich', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/xH58yMNpCDQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-1', lat: 47.3780, lng: 8.5381, name: 'Zürich - Bahnhofstrasse', city: 'Zürich', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/LWX9sE4pM7I?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-2', lat: 46.2044, lng: 6.1432, name: 'Geneva - Pont du Mont-Blanc', city: 'Geneva', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/c2y3vz6pqnc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-3', lat: 46.2100, lng: 6.1500, name: 'Geneva - Rive / Cornavin', city: 'Geneva', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/1YxHsMNolGc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-4', lat: 46.9481, lng: 7.4474, name: 'Bern - Bundesplatz', city: 'Bern', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/TFRiHmM6BPM?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-5', lat: 46.9478, lng: 7.4562, name: 'Bern - Kirchenfeldbrücke', city: 'Bern', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/rMuOZuqKnvo?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-6', lat: 47.5596, lng: 7.5886, name: 'Basel - Mittlere Brücke', city: 'Basel', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/AO4X-WBMWCY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-7', lat: 46.5233, lng: 6.6327, name: 'Lausanne - Flon', city: 'Lausanne', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/nI5M0B_nB8o?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-8', lat: 47.0502, lng: 8.3093, name: 'Luzern - Kapellbrücke', city: 'Luzern', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/vkfJV5UjNT0?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-9', lat: 47.6833, lng: 9.1833, name: 'Konstanz / Kreuzlingen - Border', city: 'Kreuzlingen', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/pFiFzXEYUJY?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-10', lat: 46.0037, lng: 8.9511, name: 'Lugano - Piazza della Riforma', city: 'Lugano', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/X2WDjx-Rl_A?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-11', lat: 46.8200, lng: 9.8400, name: 'Chur - A13 Rheinwald', city: 'Chur', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/aXbIAW-IHHQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-12', lat: 46.9167, lng: 8.2167, name: 'Sarnen - A8 Brünig', city: 'Sarnen', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/3sWN_gHN7Bc?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-13', lat: 47.3667, lng: 7.3500, name: 'Solothurn - A5', city: 'Solothurn', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/eDWqy5l9v5g?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-14', lat: 46.3500, lng: 7.3500, name: 'Sion - A9 Valais', city: 'Sion', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/PtXaZLW5gAA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-15', lat: 47.8500, lng: 9.0000, name: 'Schaffhausen - Rheinfall', city: 'Schaffhausen', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/6YCSA-BT0qQ?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-16', lat: 47.4667, lng: 8.6667, name: 'Winterthur - A1', city: 'Winterthur', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/5OiuqNSKI2I?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-17', lat: 46.6786, lng: 7.8667, name: 'Grindelwald - Alpine Cam', city: 'Grindelwald', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/KpFMg7wQlpU?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-18', lat: 45.8992, lng: 7.7215, name: 'Zermatt - Matterhorn View', city: 'Zermatt', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/wqzPM_GnHxI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
  { id: 'ch-19', lat: 46.5500, lng: 8.3500, name: 'Gotthard - San Gottardo Pass', city: 'Airolo', country: 'Switzerland', stream_url: 'https://www.youtube.com/embed/BXGR29kbxiA?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'ASTRA CH' },
];

export async function fetchSwitzerlandCameras(): Promise<CctvCamera[]> {
  return SWITZERLAND_STATIC;
}
