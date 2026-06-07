import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Active Conflict Zones
 * Labeled geopolitical hotspots. Server-side so they can be updated without a redeploy.
 * Merged with live ACLED/ReliefWeb event data from /api/conflicts for full picture.
 */

const CONFLICT_ZONES = [
  // Active wars
  { id: 'ukraine-war', label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lng: 31.2, description: 'Full-scale Russian invasion since Feb 2022. Frontline spans eastern + southern Ukraine.' },
  { id: 'gaza-conflict', label: 'GAZA/WEST BANK', severity: 'war', lat: 31.35, lng: 34.35, description: 'Ongoing Israel-Hamas conflict; extensive urban warfare + humanitarian crisis.' },
  { id: 'sudan-civil-war', label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lng: 30.0, description: 'SAF vs. RSF armed conflict since April 2023; mass displacement.' },
  { id: 'myanmar-conflict', label: 'MYANMAR CIVIL WAR', severity: 'war', lat: 19.5, lng: 96.5, description: 'Multi-front armed resistance vs. military junta (Tatmadaw) since 2021 coup.' },
  { id: 'drc-conflict', label: 'DRC EASTERN CONFLICT', severity: 'war', lat: -1.0, lng: 28.5, description: 'M23/Rwanda + multiple armed groups vs. FARDC in North Kivu, Ituri.' },
  { id: 'yemen-war', label: 'YEMEN WAR', severity: 'war', lat: 15.5, lng: 48.0, description: 'Houthi control of north; ongoing coalition air operations; Red Sea attacks on shipping.' },
  { id: 'somalia', label: 'SOMALIA / AL-SHABAAB', severity: 'war', lat: 5.0, lng: 46.0, description: 'Al-Shabaab insurgency across southern/central Somalia; US drone strikes ongoing.' },
  // Active high-tension
  { id: 'lebanon-border', label: 'LEBANON/HEZBOLLAH', severity: 'high', lat: 33.4, lng: 35.8, description: 'Post-ceasefire fragile state; IDF border operations ongoing.' },
  { id: 'syria', label: 'SYRIA', severity: 'high', lat: 35.0, lng: 38.5, description: 'Fractured control: Assad (with Russia/Iran), SDF (US-backed), HTS in Idlib.' },
  { id: 'sahel', label: 'SAHEL INSTABILITY', severity: 'high', lat: 14.0, lng: 5.0, description: 'Mali, Burkina Faso, Niger juntas; Wagner/Africa Corps present; jihadist insurgencies.' },
  { id: 'red-sea', label: 'RED SEA THREAT ZONE', severity: 'high', lat: 16.0, lng: 40.0, description: 'Houthi anti-shipping campaign; US/UK coalition strikes; global supply chain impact.' },
  { id: 'nigeria-northwest', label: 'NIGERIA NW CONFLICT', severity: 'high', lat: 11.5, lng: 7.0, description: 'Bandit groups + Boko Haram remnants; mass kidnappings, civilian deaths.' },
  { id: 'mozambique-cabo', label: 'MOZAMBIQUE CABO DELGADO', severity: 'high', lat: -12.3, lng: 39.5, description: 'Islamic State–affiliated Ansar al-Sunna insurgency; SADC/Rwanda forces deployed.' },
  // Elevated tension
  { id: 'taiwan-strait', label: 'TAIWAN STRAIT', severity: 'elevated', lat: 24.0, lng: 119.5, description: 'PLA military exercises + air incursions increasing; US carrier operations ongoing.' },
  { id: 'korean-dmz', label: 'KOREAN DMZ', severity: 'elevated', lat: 38.3, lng: 127.0, description: 'DPRK ballistic missile tests + satellite launches; inter-Korean relations severed.' },
  { id: 'armenia-azerbaijan', label: 'SOUTH CAUCASUS', severity: 'elevated', lat: 40.0, lng: 46.0, description: 'Post-conflict Nagorno-Karabakh; Armenia/Azerbaijan border tensions.' },
  { id: 'kashmir', label: 'KASHMIR LINE OF CONTROL', severity: 'elevated', lat: 34.5, lng: 74.5, description: 'India-Pakistan nuclear flashpoint; intermittent cross-border incidents.' },
  { id: 'south-china-sea', label: 'SOUTH CHINA SEA', severity: 'elevated', lat: 12.0, lng: 113.0, description: 'PLA vs. Philippine Coast Guard at Scarborough/Second Thomas Shoal; US patrols.' },
  { id: 'baltic-sea', label: 'BALTIC TENSION ZONE', severity: 'elevated', lat: 57.0, lng: 20.0, description: 'Post-Ukraine Russian military pressure on Baltic states; NATO reinforcement ongoing.' },
  { id: 'arctic', label: 'ARCTIC MILITARIZATION', severity: 'elevated', lat: 82.0, lng: 0.0, description: 'Russia + China arctic buildup; NATO Arctic response; Northern Sea Route competition.' },
];

export async function GET() {
  return NextResponse.json(
    { zones: CONFLICT_ZONES, total: CONFLICT_ZONES.length, timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
