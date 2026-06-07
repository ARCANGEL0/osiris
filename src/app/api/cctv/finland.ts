import type { CctvCamera } from './types';

export async function fetchFinlandCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    const res = await fetch(
      'https://tie.digitraffic.fi/api/v3/metadata/camera-stations',
      {
        signal: AbortSignal.timeout(12000),
        headers: { 'Accept': 'application/json', 'Digitraffic-User': 'OSIRIS/1.0' },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const stations: any[] = data?.cameraStations || [];
    for (const station of stations) {
      const coords: number[] = station.geometry?.coordinates || [];
      if (coords.length < 2) continue;
      const lng = coords[0];
      const lat = coords[1];
      const presets: any[] = station.cameraPresets || [];
      for (const preset of presets) {
        if (!preset.inCollection || !preset.imageUrl) continue;
        cams.push({
          id: `fi-${station.id}-${preset.presetId}`,
          lat,
          lng,
          name: preset.presentationName || station.name || `Tiekamera ${station.id}`,
          city: 'Finland',
          country: 'Finland',
          feed_url: preset.imageUrl,
          source: 'Digitraffic FI',
        });
      }
    }
  } catch { return []; }
  return cams.filter(c => c.lat && c.lng);
}
