import type { CctvCamera } from './types';

const PORTUGAL_STATIC: CctvCamera[] = [
  { id: 'pt-0', lat: 38.7169, lng: -9.1427, name: 'Lisboa - Marquês de Pombal', city: 'Lisboa', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/M_HbJNnwHMs?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-1', lat: 38.7071, lng: -9.1368, name: 'Lisboa - Praça do Comércio', city: 'Lisboa', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/zDgjrZ0Dmao?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-2', lat: 38.7565, lng: -9.1568, name: 'Lisboa - Ponte 25 de Abril', city: 'Lisboa', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/CmTPrX2ZJrs?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-3', lat: 38.7200, lng: -9.0900, name: 'Lisboa - A2 Sul', city: 'Lisboa', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/VExF_cPHI-8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-4', lat: 41.1496, lng: -8.6109, name: 'Porto - Ribeira', city: 'Porto', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/6rrB12jFblw?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-5', lat: 41.1579, lng: -8.6291, name: 'Porto - Ponte Luís I', city: 'Porto', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/oaqv2dLTqvE?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-6', lat: 41.1800, lng: -8.6500, name: 'Porto - Via de Cintura Interna', city: 'Porto', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/3AY3XZFWUSE?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-7', lat: 37.0179, lng: -7.9307, name: 'Faro - EN125 Algarve', city: 'Faro', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/naqmrLkf0X4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-8', lat: 37.0900, lng: -8.2500, name: 'Albufeira - Algarve Coast', city: 'Albufeira', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/JTRMJHpOFv8?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-9', lat: 38.5667, lng: -8.9000, name: 'Setúbal - A2', city: 'Setúbal', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/HOKfZi-BQ1Q?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-10', lat: 40.2033, lng: -8.4103, name: 'Coimbra - Ponte de Santa Clara', city: 'Coimbra', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/f4w0Bh1ZPGI?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
  { id: 'pt-11', lat: 32.6669, lng: -16.9241, name: 'Funchal - Madeira', city: 'Funchal', country: 'Portugal', stream_url: 'https://www.youtube.com/embed/pRVCvKkrqj4?autoplay=1&mute=1&controls=0', stream_type: 'iframe', source: 'IP Portugal' },
];

export async function fetchPortugalCameras(): Promise<CctvCamera[]> {
  return PORTUGAL_STATIC;
}
