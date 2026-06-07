import type { CctvCamera } from "./types";
import { SHODAN_CAMERAS } from "@/data/shodan-camera-data";

/**
 * OSIRIS — Shodan IP Camera Discovery
 * Pre-scanned IP camera data from Shodan (2,480+ cameras worldwide)
 */

export async function fetchShodanCameras(): Promise<CctvCamera[]> {
  return SHODAN_CAMERAS || [];
}

export async function fetchShodanCamerasByCountry(country: string): Promise<CctvCamera[]> {
  const cams = await fetchShodanCameras();
  const q = country.toLowerCase();
  return cams.filter(c => c.country?.toLowerCase().includes(q));
}

export async function fetchShodanCamerasNearby(
  lat: number, lng: number, radiusKm: number = 50
): Promise<CctvCamera[]> {
  const cams = await fetchShodanCameras();
  return cams.filter(c => {
    const dlat = c.lat - lat;
    const dlng = c.lng - lng;
    const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    return dist <= radiusKm;
  });
}
