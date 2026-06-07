'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface OsirisMapProps {
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  flyToLocation?: { lat: number; lng: number; ts: number } | null;
  projection?: 'mercator' | 'globe';
  mapStyle?: string;
  sweepData?: any;
  scanTargets?: any[];
}

function computeSolarTerminator(): [number, number][] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - utcHours) * 15;
  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subsolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }
  const darkSide = declination >= 0 ? -90 : 90;
  points.push([180, darkSide]);
  points.push([-180, darkSide]);
  points.push(points[0]);
  return points;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function OsirisMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, flyToLocation, projection = 'globe', mapStyle = 'dark', sweepData, scanTargets = [] }: OsirisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const prevStyleRef = useRef(mapStyle);

  // Create aircraft icon on canvas (for WebGL symbol layer)
  const createIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [25.48, 42.70], zoom: 6.5, minZoom: 1.5, maxZoom: 18,
      attributionControl: false,
      maxPitch: 85,
    });

    map.on('load', () => {
      mapRef.current = map;
      // Create icons
      createIcon(map, 'plane-cyan', '#00E5FF', 24);
      createIcon(map, 'plane-green', '#00E676', 24);
      createIcon(map, 'plane-pink', '#FF69B4', 24);
      createIcon(map, 'plane-red', '#FF3D3D', 24);
      createIcon(map, 'plane-grey', '#555555', 24);
      createDot(map, 'dot-gold', '#D4AF37', 8);
      createDot(map, 'dot-red', '#FF3D3D', 10);
      createDot(map, 'dot-orange', '#FF9500', 10);
      createDot(map, 'dot-green', '#00E676', 10);
      createDot(map, 'dot-fire', '#FF6B00', 10);
      createDot(map, 'dot-cctv', '#39FF14', 10);
      createDot(map, 'dot-shodan', '#FF00FF', 10);

      // Sources
      const sources = ['flights','military','jets','private-fl','satellites','earthquakes','gdelt','gps-jamming','day-night','cctv','shodan-cctv','fires','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','sigint-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'volcanoes', 'storms', 'conflict-events', 'internet-outages', 'cable-points', 'humanitarian', 'mil-bases', 'mil-sats', 'notam-zones', 'sigint-stations', 'apt-groups', 'spyware-ops', 'ripe-probes', 'device-heatmap'];
      sources.forEach(s => map.addSource(s, { type: 'geojson', data: EMPTY_FC }));

      // Warning icon generator (parameterized — eliminates 3x copy-paste)
      const createWarningIcon = (id: string, color: string) => {
        const s = 20;
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s/2, 1);
        ctx.lineTo(s - 1, s - 1);
        ctx.lineTo(1, s - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', s/2, s - 4);
        map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
      };
      createWarningIcon('warn-icon', '#FF1744');
      createWarningIcon('warn-orange', '#FF9500');
      createWarningIcon('warn-yellow', '#FFD500');

      // Volcanoes
      map.addLayer({ id: 'volcano-glow', type: 'circle', source: 'volcanoes', paint: { 'circle-radius': 18, 'circle-color': '#FF6B35', 'circle-opacity': 0.1, 'circle-blur': 1 }});
      map.addLayer({ id: 'volcano-dots', type: 'circle', source: 'volcanoes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': ['match',['get','alert_level'],'Red','#FF1744','Orange','#FF6B35','Yellow','#FFD700','#76FF03'],
        'circle-opacity': 0.9, 'circle-stroke-width': 2, 'circle-stroke-color': '#FF6B35', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'volcano-label', type: 'symbol', source: 'volcanoes', minzoom: 3, layout: {
        'text-field': ['concat','🌋 ',['get','name']], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 2], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF6B35', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Tropical Storms
      map.addLayer({ id: 'storm-glow', type: 'circle', source: 'storms', paint: { 'circle-radius': 40, 'circle-color': '#00BCD4', 'circle-opacity': 0.07, 'circle-blur': 1 }});
      map.addLayer({ id: 'storm-dots', type: 'circle', source: 'storms', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,12, 10,18],
        'circle-color': '#00BCD4', 'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': '#00BCD4', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'storm-label', type: 'symbol', source: 'storms', layout: {
        'text-field': ['concat','🌀 ',['get','name']], 'text-size': 10, 'text-font': ['Open Sans Bold'], 'text-offset': [0, 2.2], 'text-allow-overlap': true,
      }, paint: { 'text-color': '#00BCD4', 'text-halo-color': '#000', 'text-halo-width': 1.5 }});

      // Armed Conflict Events
      map.addLayer({ id: 'conflict-event-glow', type: 'circle', source: 'conflict-events', paint: { 'circle-radius': 10, 'circle-color': '#FF1744', 'circle-opacity': 0.1, 'circle-blur': 1 }});
      map.addLayer({ id: 'conflict-event-dots', type: 'circle', source: 'conflict-events', paint: {
        'circle-radius': 4, 'circle-color': '#FF1744', 'circle-opacity': 0.75, 'circle-stroke-width': 1, 'circle-stroke-color': '#FF1744', 'circle-stroke-opacity': 0.4,
      }});

      // Internet Outages
      map.addLayer({ id: 'outage-glow', type: 'circle', source: 'internet-outages', paint: { 'circle-radius': 30, 'circle-color': '#2196F3', 'circle-opacity': 0.08, 'circle-blur': 1 }});
      map.addLayer({ id: 'outage-dots', type: 'circle', source: 'internet-outages', paint: {
        'circle-radius': 7, 'circle-color': '#2196F3', 'circle-opacity': 0.8, 'circle-stroke-width': 2, 'circle-stroke-color': '#2196F3', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'outage-label', type: 'symbol', source: 'internet-outages', minzoom: 3, layout: {
        'text-field': ['get','location'], 'text-size': 8, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.8],
      }, paint: { 'text-color': '#2196F3', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Submarine Cable Landing Points
      map.addLayer({ id: 'cable-glow', type: 'circle', source: 'cable-points', paint: { 'circle-radius': 8, 'circle-color': '#00E5FF', 'circle-opacity': 0.1, 'circle-blur': 1 }});
      map.addLayer({ id: 'cable-dots', type: 'circle', source: 'cable-points', paint: {
        'circle-radius': 4, 'circle-color': '#00E5FF', 'circle-opacity': 0.8, 'circle-stroke-width': 1, 'circle-stroke-color': '#00E5FF', 'circle-stroke-opacity': 0.5,
      }});

      // Humanitarian Alerts
      map.addLayer({ id: 'humanitarian-glow', type: 'circle', source: 'humanitarian', paint: { 'circle-radius': 14, 'circle-color': '#FF9500', 'circle-opacity': 0.1, 'circle-blur': 1 }});
      map.addLayer({ id: 'humanitarian-dots', type: 'circle', source: 'humanitarian', paint: {
        'circle-radius': 5, 'circle-color': '#FF9500', 'circle-opacity': 0.75, 'circle-stroke-width': 1, 'circle-stroke-color': '#FF9500', 'circle-stroke-opacity': 0.4,
      }});

      // Military Satellites
      createDot(map, 'dot-milsat', '#FF3D3D', 8);
      map.addLayer({ id: 'milsat-glow', type: 'circle', source: 'mil-sats', paint: {
        'circle-radius': 12, 'circle-color': '#FF3D3D', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'milsat-dots', type: 'circle', source: 'mil-sats', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'circle-color': ['match',['get','nation'],'US','#FF1744','Russia','#FF6B00','China','#FFD700','#E040FB'],
        'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'milsat-label', type: 'symbol', source: 'mil-sats', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 8, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF3D3D', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // NOTAM / Restricted Airspace
      map.addLayer({ id: 'notam-fill', type: 'circle', source: 'notam-zones', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,50],
        'circle-color': ['match',['get','type'],'tfr','#FF9500','military','#FF1744','prohibited','#FF1744','#FFD700'],
        'circle-opacity': 0.12, 'circle-blur': 0.5,
      }});
      map.addLayer({ id: 'notam-border', type: 'circle', source: 'notam-zones', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,50],
        'circle-color': 'transparent', 'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match',['get','type'],'tfr','#FF9500','military','#FF1744','prohibited','#FF1744','#FFD700'],
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'notam-label', type: 'symbol', source: 'notam-zones', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 8, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 0], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF9500', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Military Bases — color-coded by operator classification
      createDot(map, 'dot-mil-us', '#FF1744', 10);
      createDot(map, 'dot-mil-ru', '#FF6B00', 10);
      createDot(map, 'dot-mil-cn', '#FFD700', 10);
      createDot(map, 'dot-mil-nato', '#448AFF', 10);
      createDot(map, 'dot-mil-other', '#9C27B0', 10);
      map.addLayer({ id: 'mil-base-glow', type: 'circle', source: 'mil-bases', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,20],
        'circle-color': ['match',['get','classification'],'US','#FF1744','Russia','#FF6B00','China','#FFD700','NATO','#448AFF','Five Eyes','#00E676','#9C27B0'],
        'circle-opacity': 0.07, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'mil-base-dots', type: 'circle', source: 'mil-bases', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'circle-color': ['match',['get','classification'],'US','#FF1744','Russia','#FF6B00','China','#FFD700','NATO','#448AFF','Five Eyes','#00E676','Israel','#00BCD4','UK','#76FF03','Iran','#FF9500','DPRK','#E040FB','#9C27B0'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match',['get','classification'],'US','#FF1744','Russia','#FF6B00','China','#FFD700','NATO','#448AFF','Five Eyes','#00E676','#9C27B0'],
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'mil-base-label', type: 'symbol', source: 'mil-bases', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 8, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.6], 'text-allow-overlap': false, 'text-max-width': 10,
      }, paint: { 'text-color': '#FF1744', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // SIGINT Stations
      map.addLayer({ id: 'sigint-glow', type: 'circle', source: 'sigint-stations', paint: {
        'circle-radius': 16, 'circle-color': '#FF9500', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sigint-dots', type: 'circle', source: 'sigint-stations', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,11],
        'circle-color': '#FF9500', 'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF9500', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'sigint-label', type: 'symbol', source: 'sigint-stations', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 8, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.8], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF9500', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // APT Groups
      map.addLayer({ id: 'apt-glow', type: 'circle', source: 'apt-groups', paint: {
        'circle-radius': 20, 'circle-color': '#E040FB', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'apt-dots', type: 'circle', source: 'apt-groups', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': ['match',['get','tlp_color'],'#FF1744','#FF1744','#FF9500','#FF9500','#FFD700','#FFD700','#E040FB'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': '#E040FB', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'apt-label', type: 'symbol', source: 'apt-groups', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'], 'text-offset': [0, 1.8], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E040FB', 'text-halo-color': '#000', 'text-halo-width': 1.5 }});

      // Spyware Infrastructure
      map.addLayer({ id: 'spyware-glow', type: 'circle', source: 'spyware-ops', paint: {
        'circle-radius': 18, 'circle-color': '#FF3D3D', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'spyware-dots', type: 'circle', source: 'spyware-ops', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,11],
        'circle-color': ['match',['get','status'],'sanctioned','#FF1744','defunct','#757575','#FF3D3D'],
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'spyware-label', type: 'symbol', source: 'spyware-ops', minzoom: 4, layout: {
        'text-field': ['concat','🕵 ',['get','name']], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.8], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF3D3D', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // ── RIPE Atlas internet measurement nodes (14k+ tiny cyan dots) ──
      map.addLayer({ id: 'ripe-dots', type: 'circle', source: 'ripe-probes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,2.5, 10,4],
        'circle-color': ['case', ['get','is_anchor'], '#FFD700', '#00E5FF'],
        'circle-opacity': 0.7,
        'circle-stroke-width': ['case', ['get','is_anchor'], 1, 0],
        'circle-stroke-color': '#FFD700',
      }});

      // ── Device exposure heatmap — graduated by device count ──
      map.addLayer({ id: 'device-heat', type: 'circle', source: 'device-heatmap', paint: {
        'circle-radius': ['interpolate',['linear'],['get','count'], 10,6, 10000,18, 500000,40],
        'circle-color': ['get','color'],
        'circle-opacity': 0.18, 'circle-blur': 0.8,
      }});
      map.addLayer({ id: 'device-core', type: 'circle', source: 'device-heatmap', paint: {
        'circle-radius': ['interpolate',['linear'],['get','count'], 10,2, 10000,5, 500000,9],
        'circle-color': ['get','color'], 'circle-opacity': 0.85,
      }});

      map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', layout: {
        'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
        'icon-size': ['interpolate',['linear'],['zoom'], 1,0.6, 4,0.8, 8,1],
        'icon-allow-overlap': true,
        'text-field': ['get','label'],
        'text-size': ['interpolate',['linear'],['zoom'], 1,7, 4,9, 8,11],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4],
        'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','severity'], 'war','#FF1744', 'high','#FF9500', '#FFD500'],
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});


      // Day/Night
      map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': '#000022', 'fill-opacity': 0.35 }});

      // Earthquakes
      map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
        'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#FFD700', 4,'#FF9500', 6,'#FF1744'],
        'circle-opacity': 0.6, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#FFD700', 'circle-stroke-opacity': 0.3,
      }});
      map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
        'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0,1.5],
      }, paint: { 'text-color': '#FFD700', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Fires
      map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
        'circle-color': '#FF6B00', 'circle-opacity': 0.5, 'circle-blur': 0.5,
      }});

      // CCTV — outer glow ring
      map.addLayer({ id: 'cctv-glow', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
        'circle-color': '#39FF14', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      // CCTV — main dot
      map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8, 14,12],
        'circle-color': '#39FF14', 'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': '#39FF14', 'circle-stroke-opacity': 0.5,
      }});
      // Shodan CCTV — outer glow ring
      map.addLayer({ id: 'shodan-glow', type: 'circle', source: 'shodan-cctv', paint: {
        'circle-radius': 14, 'circle-color': '#FF00FF', 'circle-opacity': 0.15, 'circle-blur': 1.5,
      }});
      // Shodan CCTV — main dot
      map.addLayer({ id: 'shodan-dots', type: 'circle', source: 'shodan-cctv', paint: {
        'circle-radius': 5, 'circle-color': '#FF00FF', 'circle-opacity': 0.9,
        'circle-stroke-width': 1, 'circle-stroke-color': '#FF00FF',
      }});
      // Shodan CCTV — labels at zoom 10+
      map.addLayer({ id: 'shodan-label', type: 'symbol', source: 'shodan-cctv', minzoom: 10, layout: {
        'text-field': ['get', 'name'], 'text-size': 9, 'text-color': '#FF00FF', 'text-offset': [0, -1.5],
      }});

      // CCTV — labels at zoom 10+
      map.addLayer({ id: 'cctv-label', type: 'symbol', source: 'cctv', minzoom: 10, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#39FF14', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // GDELT
      map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
        'circle-radius': 4, 'circle-color': '#FF3D3D', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.3,
      }});

      // GPS Jamming
      map.addLayer({ id: 'jam-fill', type: 'circle', source: 'gps-jamming', paint: { 'circle-radius': 30, 'circle-color': '#FF0000', 'circle-opacity': 0.15, 'circle-blur': 1 }});
      map.addLayer({ id: 'jam-label', type: 'symbol', source: 'gps-jamming', layout: {
        'text-field': ['concat','GPS JAM ',['to-string',['get','severity']],'%'], 'text-size': 10, 'text-font': ['Open Sans Bold'], 'text-allow-overlap': true,
      }, paint: { 'text-color': '#FF4444', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Weather Events (NASA EONET — storms, volcanoes)
      map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
        'circle-color': '#E040FB', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
        'circle-color': ['match', ['get','icon'], 'cyclone','#E040FB', 'volcano','#FF1744', '#E040FB'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': '#E040FB', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
        'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E040FB', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Nuclear Infrastructure
      map.addLayer({ id: 'infra-glow', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#FF9500', '#76FF03'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': ['case', 
          ['in', 'SEISMIC RISK', ['get', 'status']], '#FF9500',
          ['==', ['get','status'], 'Active Conflict Zone'], '#FF1744', 
          ['==', ['get','status'], 'Destroyed / Decommissioning'], '#757575', 
          '#76FF03'
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#FF9500', '#76FF03'], 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#FF9500', '#76FF03'], 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Satellites
      map.addLayer({ id: 'sat-glow', type: 'circle', source: 'satellites', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,6], 'circle-color': ['get','color'], 'circle-opacity': 0.3, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 1.0,
      }});

      // Maritime — ports & naval bases
      map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'],
        'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
        'circle-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'], 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#00BCD4', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Maritime chokepoints — pulsing warning diamonds
      map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
        'circle-color': '#FF9500', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'circle-color': ['match', ['get','risk'], 'CRITICAL','#FF1744', 'HIGH','#FF9500', 'ELEVATED','#FFD700', '#00E676'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF9500', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF9500', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

      // Live News — broadcast dots
      map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#FF4081', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': '#FF4081', 'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF4081', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF4081', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // SIGINT RSS news - gold markers
      map.addLayer({ id: 'sigint-news-glow', type: 'circle', source: 'sigint-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,10, 10,18],
        'circle-color': '#D4AF37', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sigint-news-dots', type: 'circle', source: 'sigint-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'circle-color': '#D4AF37', 'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFF8DC', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'sigint-news-label', type: 'symbol', source: 'sigint-news', minzoom: 5, layout: {
        'text-field': ['get','source'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.6], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D4AF37', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85 }});

      // ══ IP SWEEP — Neighborhood device visualization ══
      map.addLayer({ id: 'sweep-connections', type: 'line', source: 'ip-sweep-connections', paint: {
        'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [2, 4],
      }});
      map.addLayer({ id: 'sweep-pulse-ring', type: 'circle', source: 'ip-sweep-pulse', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,40, 12,80, 16,160],
        'circle-color': 'transparent', 'circle-opacity': 0.6,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'sweep-device-glow', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,8, 12,16, 16,30],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sweep-device-dots', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,6, 16,10],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'sweep-device-labels', type: 'symbol', source: 'ip-sweep-devices', minzoom: 13, layout: {
        'text-field': ['concat', ['get', 'device_type'], '\n', ['get', 'ip']],
        'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});

      // ══ SCAN TARGETS — Geolocated individual scans ══
      map.addLayer({ id: 'scan-targets-glow', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,40],
        'circle-color': '#FF3D3D', 'circle-opacity': 0.2, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'scan-targets-dots', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': '#FF3D3D', 'circle-opacity': 0.95,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.8,
      }});
      map.addLayer({ id: 'scan-targets-label', type: 'symbol', source: 'scan-targets', layout: {
        'text-field': ['get', 'id'], 'text-size': 11, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF3D3D', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

      // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
      const flightLayers = [
        { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
        { id: 'fl-private', src: 'private-fl', icon: 'plane-green' },
        { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
        { id: 'fl-military', src: 'military', icon: 'plane-red' },
      ];
      flightLayers.forEach(l => {
        map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
          'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
          'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }, paint: { 'icon-opacity': 0.85 }});
      });

      // Balloons (moving entities)
      map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
        'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Radiation (glow based on reading level)
      map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
        'circle-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'],
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
        'circle-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'], 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
        'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Maritime Ships (moving entities)
      map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'circle-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9500', 'cargo','#00BCD4', '#fff'],
        'circle-opacity': 0.8,
      }});
      map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9500', 'cargo','#00BCD4', '#fff'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      setMapReady(true);
    });

    // Events
    let lastMove = 0;
    map.on('mousemove', e => {
      const now = Date.now();
      if (now - lastMove > 100) {
        lastMove = now;
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    map.on('contextmenu', e => { e.preventDefault(); onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    map.on('moveend', () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); });

    // ── POPUP HELPER ──
    const popup = (coords: any, html: string) => {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
    };
    const pStyle = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
    const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

    // ── Flights (with FlightAware + ADS-B Exchange links) ──
    ['fl-commercial','fl-private','fl-jets','fl-military'].forEach(layer => {
      map.on('click', layer, e => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates;
        const cs = (p.callsign||'').trim();
        popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.3);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#D4AF37;font-size:16px;font-weight:700;letter-spacing:0.1em;">${cs}</span>
            <span style="color:#5C5A54;font-size:10px;">${p.icao24||''}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">
            <div><span style="color:#5C5A54;font-size:9px;">MODEL</span><br/><span style="color:#E8E6E0;">${p.model||'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">ALT</span><br/><span style="color:#00E5FF;">${p.alt?Math.round(p.alt)+'m':'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">SPEED</span><br/><span style="color:#E8E6E0;">${p.speed_knots||'—'}kt</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">HDG</span><br/><span style="color:#E8E6E0;">${Math.round(p.heading||0)}°</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">REG</span><br/><span style="color:#E8E6E0;">${p.registration||'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">POS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(2)},${coords[0].toFixed(2)}</span></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${cs}" target="_blank" style="${linkStyle}color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);">⚡ FLIGHTAWARE</a>
            <a href="https://globe.adsbexchange.com/?icao=${p.icao24||''}" target="_blank" style="${linkStyle}color:#00E5FF;border:1px solid rgba(0,229,255,0.4);background:rgba(0,229,255,0.1);">📡 ADS-B</a>
            <a href="https://www.radarbox.com/data/flights/${cs}" target="_blank" style="${linkStyle}color:#FF69B4;border:1px solid rgba(255,105,180,0.4);background:rgba(255,105,180,0.1);">📍 RADARBOX</a>
          </div>
        </div>`);
        onEntityClick?.(p);
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── Shodan CCTV (opens CameraViewer panel) ──
    map.on('click', 'shodan-dots', e => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties;
      onEntityClick?.({
        type: 'shodan',
        id: p?.id, name: p?.name, city: p?.city, country: p?.country,
        source: p?.source, feed_url: p?.feed_url, stream_url: p?.stream_url,
        stream_type: p?.stream_type, external_url: p?.external_url,
        lat: f.geometry?.coordinates[1], lng: f.geometry?.coordinates[0],
      });
    });

    // ── CCTV (opens CameraViewer panel) ──
    map.on('click', 'cctv-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      // Emit the camera data so the CameraViewer opens
      onEntityClick?.({
        type: 'cctv',
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        source: p.source,
        feed_url: p.feed_url,
        stream_url: p.stream_url,
        stream_type: p.stream_type,
        external_url: p.external_url,
        lat: coords[1],
        lng: coords[0],
      });
      // Also fly to the camera
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
    });

    // ── Earthquakes (with USGS link) ──
    map.on('click', 'eq-circles', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">M${p.magnitude} EARTHQUAKE</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${p.place||'Unknown location'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">DEPTH</span><br/><span style="color:#E8E6E0;">${p.depth||'—'}km</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>
        <a href="${p.source === 'NIGGG-BAS' ? 'https://ndc.niggg.bas.bg/' : `https://earthquake.usgs.gov/earthquakes/eventpage/${p.id||''}`}" target="_blank" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 ${p.source === 'NIGGG-BAS' ? 'NIGGG-BAS' : 'USGS DETAILS'}</a>
      </div>`);
    });

    // ── Satellites (SatNOGS powered) ──
    map.on('click', 'sat-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.3);">
        <div style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🛰️ ${p.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">MISSION</span><br/><span style="color:${p.color||'#aaa'};">${p.mission||'Unknown'}</span></div>
          <div><span style="color:#5C5A54;">ALT</span><br/><span style="color:#00E5FF;">${p.alt ? p.alt+' km' : '—'}</span></div>
          <div><span style="color:#5C5A54;">POS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°</span></div>
        </div>
        ${p.noradId ? `<a href="https://db.satnogs.org/satellite/${p.noradId}/" target="_blank" style="display:block;text-align:center;padding:4px;margin-top:6px;font-size:8px;font-family:monospace;letter-spacing:0.1em;text-decoration:none;color:#00E5FF;border:1px solid rgba(0,229,255,0.4);background:rgba(0,229,255,0.1);border-radius:2px;cursor:pointer;">🔭 SOURCE: SATNOGS</a>` : ''}
      </div>`);
    });

    // ── Fires (with NASA FIRMS link) ──
    map.on('click', 'fires-heat', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="color:#FF6B00;font-size:12px;font-weight:700;margin-bottom:6px;">🔥 ACTIVE FIRE DETECTED</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">BRIGHTNESS</span><br/><span style="color:#FF6B00;">${p.brightness||'—'}K</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:#FF6B00;border:1px solid rgba(255,107,0,0.4);background:rgba(255,107,0,0.1);">🛰️ NASA FIRMS MAP</a>
      </div>`);
    });

    // ── GDELT Conflicts (with source article) ──
    map.on('click', 'gdelt-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.3);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ CONFLICT EVENT</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.name||'Unclassified incident'}</div>
        <div style="display:flex;gap:6px;">
          ${p.url ? `<a href="${p.url}" target="_blank" style="${linkStyle}color:#FF3D3D;border:1px solid rgba(255,61,61,0.4);background:rgba(255,61,61,0.1);">SOURCE</a>` : ''}
          <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},12z" target="_blank" style="${linkStyle}color:#448AFF;border:1px solid rgba(68,138,255,0.4);background:rgba(68,138,255,0.1);">MAP</a>
        </div>
      </div>`);
    });

    // ── Global Event / Conflict Markers ──
    map.on('click', 'conflict-icons', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.severity === 'war' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : '#FFD500';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ ${p.label || 'WARNING EVENT'}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.description || 'Global event detected at this location.'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${color};">${(p.severity||'unknown').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`);
    });


    // ── Generic hover for clickables ──
    ['conflict-icons','cctv-dots','eq-circles','sat-dots','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','sigint-news-dots','balloon-dots','rad-dots','ship-dots','sweep-device-dots','scan-targets-dots'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── Scan Targets click ──
    map.on('click', 'scan-targets-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.5);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">🎯 TARGET: ${p.id}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${p.city || 'Unknown'}, ${p.country || 'Unknown'} — ${p.isp || 'Unknown ISP'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:#00E5FF;">${(p.type || 'UNKNOWN').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`);
    });

    // ── SCM Suppliers ──
    map.on('click', 'scm-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.risk_level === 'CRITICAL' ? '#FF1744' : p.risk_level === 'HIGH' ? '#FF9500' : '#00BCD4';
      const activeThreats = p.active_threats ? JSON.parse(p.active_threats) : [];
      
      let threatsHtml = '';
      if (activeThreats.length > 0) {
        threatsHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${color}40;color:${color};font-size:9px;font-weight:bold;">
          ACTIVE THREATS:<br/>${activeThreats.map((t: string) => `⚠ ${t}`).join('<br/>')}
        </div>`;
      }

      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🏢 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.category} | ${p.city}, ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">SCM RISK LEVEL</span><br/><span style="color:${color};font-weight:bold;">${p.risk_level}</span></div>
        </div>
        ${threatsHtml}
      </div>`);
    });

    // ── IP Sweep device click ──
    map.on('click', 'sweep-device-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      const ports = JSON.parse(p.ports || '[]');
      const vulns = JSON.parse(p.vulns || '[]');
      const hostnames = JSON.parse(p.hostnames || '[]');
      const riskColors: Record<string, string> = { CRITICAL: '#FF3D3D', HIGH: '#FF6B00', MEDIUM: '#FFD700', LOW: '#76FF03', INFO: '#5C5A54' };
      popup(coords, `<div style="font-family:monospace;font-size:11px;color:#E8E6E0;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:${p.color};">${p.device_type}</div>
        <div style="font-size:12px;margin-bottom:8px;color:#fff;">${p.ip}</div>
        ${hostnames.length > 0 ? `<div style="font-size:9px;color:#8A8880;margin-bottom:6px;">${hostnames.join(', ')}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">PORTS</span><br/><span style="color:#E8E6E0;">${ports.length}</span></div>
          <div><span style="color:#5C5A54;">RISK</span><br/><span style="color:${riskColors[p.risk_level] || '#666'};">${p.risk_level}</span></div>
        </div>
        <div style="font-size:9px;color:#8A8880;margin-bottom:6px;">Open: ${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' ...' : ''}</div>
        ${vulns.length > 0 ? `<div style="font-size:9px;color:#FF3D3D;margin-bottom:6px;">⚠ CVEs: ${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` +${vulns.length - 5} more` : ''}</div>` : ''}
      </div>`);
    });

    // ── Balloons / Sondes ──
    map.on('click', 'balloon-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${p.callsign}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type.toUpperCase()} / STATUS: ${p.status.toUpperCase()}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:#E8E6E0;">${p.altitude} m</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} km/h</span></div>
          <div><span style="color:#5C5A54;">VERT RATE</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} m/s</span></div>
          <div><span style="color:#5C5A54;">TEMP</span><br/><span style="color:#E8E6E0;">${p.temperature}°C</span></div>
        </div>
      </div>`);
    });

    // ── Radiation ──
    map.on('click', 'rad-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.status === 'DANGER' ? '#FF1744' : p.status === 'WARNING' ? '#FF9500' : '#AB47BC';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city}, ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">READING</span><br/><span style="color:${color};font-weight:bold;">${p.reading} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${color};">${p.status}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">NETWORK</span><br/><span style="color:#E8E6E0;">${p.network}</span></div>
        </div>
      </div>`);
    });

    // ── Maritime Ships ──
    map.on('click', 'ship-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.type === 'military' ? '#FF1744' : p.type === 'tanker' ? '#FF9500' : '#00BCD4';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">🚢 ${p.name}</span>
          <span style="color:#aaa;font-size:9px;">${p.flag}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:${color};">${p.type.toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${p.speed} knots</span></div>
          <div><span style="color:#5C5A54;">HEADING</span><br/><span style="color:#E8E6E0;">${p.heading}°</span></div>
          <div><span style="color:#5C5A54;">DEST</span><br/><span style="color:#E8E6E0;">${p.destination || 'UNKNOWN'}</span></div>
        </div>
      </div>`);
    });

    // ── Weather Events (NASA EONET) ──
    map.on('click', 'weather-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : '⚡';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${p.type || 'Weather Event'}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.title || 'Unknown event'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${(p.severity||'low').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.source ? `<a href="${p.source}" target="_blank" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 SOURCE</a>` : ''}
          <a href="https://eonet.gsfc.nasa.gov/api/v3/events/${p.id || ''}" target="_blank" style="${linkStyle}color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);">🛰️ NASA EONET</a>
        </div>
      </div>`);
    });

    // ── Nuclear Infrastructure ──
    map.on('click', 'infra-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusColor = p.status.includes('SEISMIC RISK') ? '#FF9500' : p.status === 'Active Conflict Zone' ? '#FF1744' : p.status === 'Operational' ? '#76FF03' : '#757575';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(118,255,3,0.3);">
        <div style="color:#76FF03;font-size:14px;font-weight:700;margin-bottom:4px;">☢️ ${p.name || 'Nuclear Facility'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor};">${p.status || '—'}</span></div>
          <div><span style="color:#5C5A54;">CITY</span><br/><span style="color:#E8E6E0;">${p.city || '—'}, ${p.country || ''}</span></div>
          <div><span style="color:#5C5A54;">REACTORS</span><br/><span style="color:#76FF03;">${p.reactors || '—'}</span></div>
          <div><span style="color:#5C5A54;">CAPACITY</span><br/><span style="color:#E8E6E0;">${p.capacityMW ? p.capacityMW.toLocaleString() + ' MW' : '—'}</span></div>
          <div><span style="color:#5C5A54;">OWNER</span><br/><span style="color:#E8E6E0;">${p.owner || '—'}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" style="${linkStyle}color:#76FF03;border:1px solid rgba(118,255,3,0.4);background:rgba(118,255,3,0.1);">SATELLITE VIEW</a>
      </div>`);
    });

    // ── Maritime Ports & Naval Bases ──
    map.on('click', 'maritime-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
      const typeLabel = p.type === 'naval' ? 'NAVAL BASE' : p.type === 'energy' ? 'ENERGY PORT' : 'CONTAINER PORT';
      
      const congestionHtml = p.congestion ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><span style="color:#5C5A54;font-size:9px;">CONGESTION</span><br/><span style="color:${p.congestion === 'SEVERE' ? '#FF1744' : p.congestion === 'CONGESTED' ? '#FF9500' : '#00E676'};font-weight:bold;font-size:10px;">${p.congestion}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">EST. DWELL TIME</span><br/><span style="color:#E8E6E0;font-weight:bold;font-size:10px;">${p.dwell_time || 'Unknown'}</span></div>
          </div>
        </div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${p.country}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">Volume: <span style="color:${typeColor};font-weight:bold;">${p.volume}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">Fleet: <span style="color:${typeColor};font-weight:bold;">${p.fleet}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">Global Rank: <span style="color:${typeColor};font-weight:bold;">#${p.rank}</span></div>` : ''}
        ${congestionHtml}
      </div>`);
    });

    // ── Maritime Chokepoints ──
    map.on('click', 'choke-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
      popup(coords, `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="font-size:9px;color:#aaa;">Traffic: <span style="color:#fff;">${p.traffic}</span></div>
        <div style="font-size:9px;color:#aaa;">Risk: <span style="color:${riskCol};font-weight:bold;">${p.risk}</span></div>
      </div>`);
    });

    // ── Military Satellites ──
    map.on('click', 'milsat-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const natColors: Record<string,string> = { US:'#FF1744', Russia:'#FF6B00', China:'#FFD700', Israel:'#00BCD4', India:'#FF9500' };
      const col = natColors[p.nation] || '#E040FB';
      popup(coords, `<div style="${pStyle}border:1px solid ${col}40;">
        <div style="color:${col};font-size:13px;font-weight:700;margin-bottom:3px;">🛰 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.nation} — ${p.mission}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:${col};font-weight:bold;">${p.alt?.toLocaleString()} km</span></div>
          <div><span style="color:#5C5A54;">NORAD</span><br/><span style="color:#E8E6E0;">${p.noradId}</span></div>
          <div><span style="color:#5C5A54;">POSITION</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
          <div><span style="color:#5C5A54;">MISSION</span><br/><span style="color:${col};">${p.mission}</span></div>
        </div>
        <a href="https://www.n2yo.com/satellite/?s=${p.noradId}" target="_blank" style="${linkStyle}margin-top:8px;color:${col};border:1px solid ${col}40;background:${col}15;">N2YO TRACK</a>
      </div>`);
    });

    // ── NOTAM / Restricted Airspace ──
    map.on('click', 'notam-border', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const typeColors: Record<string,string> = { tfr:'#FF9500', military:'#FF1744', prohibited:'#FF1744', restricted:'#FFD700', warning:'#FF6B00' };
      const col = typeColors[p.type] || '#FF9500';
      popup(coords, `<div style="${pStyle}border:1px solid ${col}40;">
        <div style="color:${col};font-size:12px;font-weight:700;margin-bottom:3px;">⚠️ ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${(p.type||'').toUpperCase()} — ${p.source}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          ${p.alt_floor_ft !== undefined ? `<div><span style="color:#5C5A54;">FLOOR</span><br/><span style="color:#E8E6E0;">${p.alt_floor_ft} ft</span></div>` : ''}
          ${p.alt_ceiling_ft !== undefined ? `<div><span style="color:#5C5A54;">CEILING</span><br/><span style="color:#E8E6E0;">${p.alt_ceiling_ft} ft</span></div>` : ''}
          ${p.radius_nm !== undefined ? `<div><span style="color:#5C5A54;">RADIUS</span><br/><span style="color:${col};">${p.radius_nm} NM</span></div>` : ''}
          ${p.effective_end ? `<div><span style="color:#5C5A54;">EXPIRES</span><br/><span style="color:#E8E6E0;">${p.effective_end?.slice(0,16)}</span></div>` : ''}
        </div>
        ${p.reason ? `<div style="margin-top:6px;font-size:9px;color:#8A8880;">${p.reason}</div>` : ''}
      </div>`);
    });

    // ── Military Bases ──
    map.on('click', 'mil-base-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const clsColors: Record<string, string> = { US: '#FF1744', Russia: '#FF6B00', China: '#FFD700', NATO: '#448AFF', 'Five Eyes': '#00E676', Israel: '#00BCD4', UK: '#76FF03', Iran: '#FF9500', DPRK: '#E040FB', France: '#87CEEB' };
      const col = clsColors[p.classification] || '#9C27B0';
      const typeEmoji: Record<string, string> = { air_base: '✈️', naval_base: '⚓', army_base: '🪖', intelligence: '🔍', sigint: '📡', nuclear: '☢️', missile: '🚀', command: '🎯', space: '🛸', cyber: '💻', drone: '🤖' };
      const emoji = typeEmoji[p.type] || '🏛️';
      popup(coords, `<div style="${pStyle}border:1px solid ${col}40;">
        <div style="color:${col};font-size:13px;font-weight:700;margin-bottom:3px;">${emoji} ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type?.replace(/_/g,' ').toUpperCase()} — ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:${col};font-weight:bold;">${p.classification}</span></div>
          <div><span style="color:#5C5A54;">OPERATED BY</span><br/><span style="color:#E8E6E0;">${p.operator}</span></div>
        </div>
        ${p.notes ? `<div style="margin-top:8px;font-size:9px;color:#8A8880;line-height:1.4;">${p.notes}</div>` : ''}
        <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" style="${linkStyle}margin-top:8px;color:#76FF03;border:1px solid rgba(118,255,3,0.4);background:rgba(118,255,3,0.1);">SATELLITE VIEW</a>
      </div>`);
    });

    // ── SIGINT Stations ──
    map.on('click', 'sigint-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.4);">
        <div style="color:#FF9500;font-size:13px;font-weight:700;margin-bottom:3px;">📡 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type?.toUpperCase()} — ${p.nation}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:5px;font-size:9px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#FF9500;font-weight:bold;">${p.operator}</span></div>
          ${p.program ? `<div><span style="color:#5C5A54;">PROGRAM</span><br/><span style="color:#E8E6E0;">${p.program}</span></div>` : ''}
          <div><span style="color:#5C5A54;">TARGETS</span><br/><span style="color:#aaa;">${p.targets}</span></div>
          ${p.notes ? `<div><span style="color:#5C5A54;">NOTES</span><br/><span style="color:#8A8880;">${p.notes}</span></div>` : ''}
        </div>
        <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" style="${linkStyle}margin-top:8px;color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">SATELLITE VIEW</a>
      </div>`);
    });

    // ── APT Groups ──
    map.on('click', 'apt-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const aliases = typeof p.aliases === 'string' ? JSON.parse(p.aliases || '[]') : (p.aliases || []);
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.4);">
        <div style="color:#E040FB;font-size:13px;font-weight:700;margin-bottom:3px;">🎭 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.sponsor} — ${p.nation}</div>
        <div style="font-size:8px;color:#9C27B0;margin-bottom:6px;font-family:monospace;">${aliases.join(' · ')}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:5px;font-size:9px;">
          <div><span style="color:#5C5A54;">ACTIVE SINCE</span><br/><span style="color:#E8E6E0;">${p.active_since}</span></div>
          <div><span style="color:#5C5A54;">PRIMARY TARGETS</span><br/><span style="color:#E040FB;">${p.primary_targets}</span></div>
          <div><span style="color:#5C5A54;">KNOWN TOOLS</span><br/><span style="color:#aaa;">${p.known_tools}</span></div>
          <div><span style="color:#5C5A54;">NOTABLE OPS</span><br/><span style="color:#FF9500;">${p.notable_ops}</span></div>
        </div>
      </div>`);
    });

    // ── Spyware Infrastructure ──
    map.on('click', 'spyware-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusCol = p.status === 'sanctioned' ? '#FF1744' : p.status === 'defunct' ? '#757575' : '#FF3D3D';
      const customers = typeof p.known_customers === 'string' ? JSON.parse(p.known_customers || '[]') : (p.known_customers || []);
      popup(coords, `<div style="${pStyle}border:1px solid ${statusCol}40;">
        <div style="color:${statusCol};font-size:13px;font-weight:700;margin-bottom:3px;">🕵 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.spyware_name} — ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:9px;">
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusCol};font-weight:bold;">${(p.status || '').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">TARGET OS</span><br/><span style="color:#E8E6E0;">${p.target_os}</span></div>
          <div><span style="color:#5C5A54;">EXPOSED BY</span><br/><span style="color:#aaa;">${p.exposed_by}</span></div>
          <div><span style="color:#5C5A54;">YEAR EXPOSED</span><br/><span style="color:#E8E6E0;">${p.exposure_date}</span></div>
        </div>
        ${customers.length > 0 ? `<div style="margin-top:8px;font-size:9px;"><span style="color:#5C5A54;">KNOWN CUSTOMERS:</span><br/><span style="color:#FF9500;">${customers.slice(0,8).join(', ')}${customers.length > 8 ? ' +more' : ''}</span></div>` : ''}
        ${p.notes ? `<div style="margin-top:6px;font-size:8px;color:#8A8880;">${p.notes}</div>` : ''}
      </div>`);
    });

    // ── RIPE Atlas probe ──
    map.on('click', 'ripe-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const col = p.is_anchor ? '#FFD700' : '#00E5FF';
      popup(coords, `<div style="${pStyle}border:1px solid ${col}40;">
        <div style="color:${col};font-size:12px;font-weight:700;margin-bottom:3px;">🌐 RIPE Atlas Probe #${p.probe_id}${p.is_anchor ? ' (ANCHOR)' : ''}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">${p.description || ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:9px;">
          <div><span style="color:#5C5A54;">COUNTRY</span><br/><span style="color:#E8E6E0;">${p.country || '—'}</span></div>
          <div><span style="color:#5C5A54;">ASN</span><br/><span style="color:${col};">AS${p.asn || '—'}</span></div>
        </div>
        <a href="https://atlas.ripe.net/probes/${p.probe_id}/" target="_blank" style="${linkStyle}margin-top:8px;color:${col};border:1px solid ${col}40;background:${col}15;">VIEW ON RIPE ATLAS</a>
      </div>`);
    });

    // ── Device exposure heatmap ──
    map.on('click', 'device-core', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const sevCol = p.severity === 'critical' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : p.severity === 'medium' ? '#FFD700' : '#39FF14';
      popup(coords, `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;margin-bottom:3px;">💻 ${p.category_label}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">Country: ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:9px;">
          <div><span style="color:#5C5A54;">EXPOSED HERE</span><br/><span style="color:${p.color};font-weight:bold;font-size:13px;">${Number(p.count).toLocaleString()}</span></div>
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${sevCol};font-weight:bold;">${(p.severity || '').toUpperCase()}</span></div>
        </div>
        <div style="margin-top:6px;font-size:8px;color:#8A8880;">${Number(p.total_in_category).toLocaleString()} total globally · Source: Shodan</div>
      </div>`);
    });

    // ── Volcanoes ──
    map.on('click', 'volcano-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const alertColors: Record<string, string> = { Red: '#FF1744', Orange: '#FF6B35', Yellow: '#FFD700', Green: '#00E676' };
      const col = alertColors[p.alert_level] || '#FF6B35';
      popup(coords, `<div style="${pStyle}border:1px solid ${col}40;">
        <div style="color:${col};font-size:14px;font-weight:700;margin-bottom:4px;">🌋 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type} — ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALERT LEVEL</span><br/><span style="color:${col};font-weight:bold;">${p.alert_level}</span></div>
          <div><span style="color:#5C5A54;">ELEVATION</span><br/><span style="color:#E8E6E0;">${p.elevation_m ? p.elevation_m.toLocaleString() + ' m' : '—'}</span></div>
          <div><span style="color:#5C5A54;">ACTIVITY</span><br/><span style="color:#E8E6E0;">${p.activity_level}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`);
    });

    // ── Tropical Storms ──
    map.on('click', 'storm-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(0,188,212,0.4);">
        <div style="color:#00BCD4;font-size:14px;font-weight:700;margin-bottom:4px;">🌀 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type} — ${p.basin}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;">
          <div><span style="color:#5C5A54;">MAX WINDS</span><br/><span style="color:#00BCD4;font-weight:bold;">${p.max_winds_mph || '—'} mph</span></div>
          <div><span style="color:#5C5A54;">CATEGORY</span><br/><span style="color:#E8E6E0;">${p.category || '—'}</span></div>
          <div><span style="color:#5C5A54;">PRESSURE</span><br/><span style="color:#E8E6E0;">${p.pressure_mb || '—'} mb</span></div>
          <div><span style="color:#5C5A54;">MOVEMENT</span><br/><span style="color:#E8E6E0;">${p.movement || '—'}</span></div>
        </div>
      </div>`);
    });

    // ── Conflict Events ──
    map.on('click', 'conflict-event-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,23,68,0.4);">
        <div style="color:#FF1744;font-size:12px;font-weight:700;margin-bottom:4px;">⚔️ ${p.type || 'Armed Conflict'}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">${p.location}, ${p.country} — ${p.date}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:9px;">
          ${p.actors ? `<div><span style="color:#5C5A54;">ACTORS</span><br/><span style="color:#E8E6E0;">${p.actors}</span></div>` : ''}
          ${p.fatalities !== undefined ? `<div><span style="color:#5C5A54;">FATALITIES</span><br/><span style="color:${p.fatalities > 0 ? '#FF1744' : '#00E676'};font-weight:bold;">${p.fatalities}</span></div>` : ''}
          <div><span style="color:#5C5A54;">SOURCE</span><br/><span style="color:#E8E6E0;">${p.source || '—'}</span></div>
        </div>
      </div>`);
    });

    // ── Internet Outages ──
    map.on('click', 'outage-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(33,150,243,0.4);">
        <div style="color:#2196F3;font-size:12px;font-weight:700;margin-bottom:4px;">📡 Internet Outage</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">${p.location || p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:#2196F3;">${p.type || '—'}</span></div>
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FF9500'};">${p.severity || '—'}</span></div>
          <div><span style="color:#5C5A54;">START</span><br/><span style="color:#E8E6E0;">${p.start_time?.slice(0,16) || '—'}</span></div>
          <div><span style="color:#5C5A54;">END</span><br/><span style="color:#E8E6E0;">${p.end_time?.slice(0,16) || 'ONGOING'}</span></div>
        </div>
        ${p.description ? `<div style="margin-top:6px;font-size:9px;color:#aaa;">${p.description}</div>` : ''}
      </div>`);
    });

    // ── Submarine Cable Landing Points ──
    map.on('click', 'cable-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const cables = typeof p.cables === 'string' ? JSON.parse(p.cables || '[]') : (p.cables || []);
      popup(coords, `<div style="${pStyle}border:1px solid rgba(0,229,255,0.4);">
        <div style="color:#00E5FF;font-size:12px;font-weight:700;margin-bottom:4px;">🔌 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">Submarine Cable Landing Point</div>
        <div style="font-size:9px;"><span style="color:#5C5A54;">CONNECTED CABLES</span><br/>
          <span style="color:#E8E6E0;">${Array.isArray(cables) ? cables.slice(0, 5).map((c: any) => c.name || c).join(', ') : '—'}${cables.length > 5 ? ` +${cables.length - 5} more` : ''}</span>
        </div>
      </div>`);
    });

    // ── Humanitarian Alerts ──
    map.on('click', 'humanitarian-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.4);">
        <div style="color:#FF9500;font-size:12px;font-weight:700;margin-bottom:4px;">🆘 ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:6px;">${p.type || p.primary_type} — ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${p.status === 'ongoing' ? '#FF1744' : '#FFD700'};">${(p.status || '').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">DATE</span><br/><span style="color:#E8E6E0;">${p.date?.slice(0,10) || '—'}</span></div>
        </div>
      </div>`);
    });

    // ── Live News (opens feed viewer) ──
    map.on('click', 'news-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      onEntityClick?.({
        type: 'live_news',
        name: p.name,
        city: p.city,
        country: p.country,
        url: p.url,
        category: p.category,
        embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as any;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night]);

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as any;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  // Flight data → GeoJSON (GPU rendered)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: any[]) => (arr || []).map((f: any) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      properties: { callsign: f.callsign, heading: f.heading || 0, alt: f.alt, model: f.model, speed_knots: f.speed_knots, registration: f.registration, icao24: f.icao24 },
    }));
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military]);

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map((eq: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { magnitude: eq.magnitude, place: eq.place } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('satellites', activeLayers.satellites && data.satellites ? data.satellites.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: s.color, mission: s.mission, alt: s.alt, noradId: s.noradId } })) : []);
  }, [mapReady, data.satellites, activeLayers.satellites, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('gps-jamming', activeLayers.gps_jamming && data.gps_jamming ? data.gps_jamming.map((z: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [z.lng, z.lat] }, properties: { severity: z.severity } })) : []);
  }, [mapReady, data.gps_jamming, activeLayers.gps_jamming, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('cctv', activeLayers.cctv && data.cameras ? data.cameras.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, name: c.name, city: c.city, country: c.country, source: c.source, feed_url: c.feed_url, stream_url: c.stream_url, stream_type: c.stream_type, external_url: c.external_url } })) : []);
  }, [mapReady, data.cameras, activeLayers.cctv, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fires', activeLayers.fires && data.fires ? data.fires.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { brightness: f.brightness } })) : []);
  }, [mapReady, data.fires, activeLayers.fires, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('weather', activeLayers.weather && data.weather_events ? data.weather_events.map((w: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { title: w.title, type: w.type, icon: w.icon, severity: w.severity, source: w.source, id: w.id } })) : []);
  }, [mapReady, data.weather_events, activeLayers.weather, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('infrastructure', activeLayers.infrastructure && data.infrastructure ? data.infrastructure.map((i: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { name: i.name, city: i.city, country: i.country, status: i.status, reactors: i.reactors, capacityMW: i.capacityMW, owner: i.owner } })) : []);
  }, [mapReady, data.infrastructure, activeLayers.infrastructure, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('maritime', activeLayers.maritime && data.maritime_ports ? data.maritime_ports.map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, country: p.country, type: p.type, volume: p.volume, fleet: p.fleet, rank: p.rank } })) : []);
    setGeo('maritime-choke', activeLayers.maritime && data.maritime_chokepoints ? data.maritime_chokepoints.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name, traffic: c.traffic, risk: c.risk } })) : []);
    setGeo('maritime-ships', activeLayers.maritime && data.maritime_ships ? data.maritime_ships.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name || s.mmsi?.toString(), type: s.type || 'cargo', speed: s.speed, heading: s.heading, destination: s.destination, flag: s.flag } })) : []);
  }, [mapReady, data.maritime_ports, data.maritime_chokepoints, data.maritime_ships, activeLayers.maritime, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('balloons', activeLayers.balloons && data.balloons ? data.balloons.map((b: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { callsign: b.callsign, type: b.type, status: b.status, altitude: b.altitude, speed: b.speed, verticalRate: b.verticalRate, temperature: b.temperature, color: b.color } })) : []);
  }, [mapReady, data.balloons, activeLayers.balloons, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('radiation', activeLayers.radiation && data.radiation ? data.radiation.map((r: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, city: r.city, country: r.country, reading: r.reading, status: r.status, network: r.network } })) : []);
  }, [mapReady, data.radiation, activeLayers.radiation, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { name: f.name, city: f.city, country: f.country, url: f.url, category: f.category, embed_allowed: f.embed_allowed !== false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const items = data.news || [];
    setGeo('sigint-news', activeLayers.news_intel && items.length > 0
      ? items.filter((n: any) => n.coords?.length === 2).map((n: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [n.coords[1], n.coords[0]] },
          properties: { title: n.title, source: n.source, risk_score: n.risk_score, link: n.link }
        }))
      : []);
  }, [mapReady, data.news, activeLayers.news_intel, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('mil-sats', activeLayers.mil_satellites && data.mil_satellites ? data.mil_satellites.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, nation: s.nation, mission: s.mission, alt: s.alt, noradId: s.noradId, color: s.color } })) : []);
  }, [mapReady, data.mil_satellites, activeLayers.mil_satellites, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('notam-zones', activeLayers.notam && data.notam_zones ? data.notam_zones.map((z: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [z.lng, z.lat] }, properties: { name: z.name, type: z.type, radius_nm: z.radius_nm, alt_floor_ft: z.alt_floor_ft, alt_ceiling_ft: z.alt_ceiling_ft, effective_start: z.effective_start, effective_end: z.effective_end, reason: z.reason, source: z.source } })) : []);
  }, [mapReady, data.notam_zones, activeLayers.notam, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('mil-bases', activeLayers.military_bases && data.military_bases ? data.military_bases.map((b: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { name: b.name, country: b.country, operator: b.operator, type: b.type, classification: b.classification, notes: b.notes } })) : []);
  }, [mapReady, data.military_bases, activeLayers.military_bases, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('sigint-stations', activeLayers.sigint && data.sigint_stations ? data.sigint_stations.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, operator: s.operator, nation: s.nation, type: s.type, targets: s.targets, program: s.program, notes: s.notes } })) : []);
  }, [mapReady, data.sigint_stations, activeLayers.sigint, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('apt-groups', activeLayers.apt_groups && data.apt_groups ? data.apt_groups.map((g: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [g.lng, g.lat] }, properties: { name: g.name, aliases: JSON.stringify(g.aliases), nation: g.nation, sponsor: g.sponsor, active_since: g.active_since, primary_targets: g.primary_targets, known_tools: g.known_tools, notable_ops: g.notable_ops, tlp_color: g.tlp_color } })) : []);
  }, [mapReady, data.apt_groups, activeLayers.apt_groups, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('spyware-ops', activeLayers.spyware_infra && data.spyware_operators ? data.spyware_operators.map((o: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.lng, o.lat] }, properties: { name: o.name, country: o.country, spyware_name: o.spyware_name, status: o.status, target_os: o.target_os, known_customers: JSON.stringify(o.known_customers), exposed_by: o.exposed_by, exposure_date: o.exposure_date, notes: o.notes } })) : []);
  }, [mapReady, data.spyware_operators, activeLayers.spyware_infra, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('ripe-probes', activeLayers.ripe_atlas && data.ripe_probes ? data.ripe_probes.map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, country: p.country, asn: p.asn, description: p.description, is_anchor: !!p.is_anchor, probe_id: p.probe_id } })) : []);
  }, [mapReady, data.ripe_probes, activeLayers.ripe_atlas, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('device-heatmap', activeLayers.device_heatmap && data.device_heatmap ? data.device_heatmap.map((d: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: { country: d.country, count: d.count, category_id: d.category_id, category_label: d.category_label, color: d.color, severity: d.severity, total_in_category: d.total_in_category } })) : []);
  }, [mapReady, data.device_heatmap, activeLayers.device_heatmap, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('volcanoes', activeLayers.volcanoes && data.volcanoes ? data.volcanoes.map((v: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lng, v.lat] }, properties: { name: v.name, country: v.country, type: v.type, elevation_m: v.elevation_m, activity_level: v.activity_level, alert_level: v.alert_level || 'Unknown' } })) : []);
  }, [mapReady, data.volcanoes, activeLayers.volcanoes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('storms', activeLayers.storms && data.storms ? data.storms.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, type: s.type, basin: s.basin, max_winds_mph: s.max_winds_mph, pressure_mb: s.pressure_mb, movement: s.movement, category: s.category } })) : []);
  }, [mapReady, data.storms, activeLayers.storms, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('conflict-events', activeLayers.conflicts && data.conflict_events ? data.conflict_events.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { type: c.type, location: c.location, country: c.country, date: c.date, actors: c.actors, fatalities: c.fatalities, source: c.source } })) : []);
  }, [mapReady, data.conflict_events, activeLayers.conflicts, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('internet-outages', activeLayers.internet_outages && data.internet_outages ? data.internet_outages.map((o: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.lng, o.lat] }, properties: { location: o.location, country: o.country, type: o.type, severity: o.severity, start_time: o.start_time, end_time: o.end_time, description: o.description } })) : []);
  }, [mapReady, data.internet_outages, activeLayers.internet_outages, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('cable-points', activeLayers.submarine_cables && data.cable_landing_points ? data.cable_landing_points.map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, cables: JSON.stringify(p.cables || []) } })) : []);
  }, [mapReady, data.cable_landing_points, activeLayers.submarine_cables, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('humanitarian', activeLayers.humanitarian && data.humanitarian ? data.humanitarian.map((h: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] }, properties: { name: h.name, type: h.type, primary_type: h.primary_type, country: h.country, status: h.status, date: h.date } })) : []);
  }, [mapReady, data.humanitarian, activeLayers.humanitarian, setGeo]);

  // Conflict zones — driven by /api/conflict-zones (no longer hardcoded in component)
  useEffect(() => {
    if (!mapReady) return;
    const zones = data.conflict_zones || [];
    const features = zones.map((z: any) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
      properties: { label: z.label, severity: z.severity, description: z.description },
    }));
    setGeo('conflict-zones', features);
  }, [mapReady, data.conflict_zones, setGeo]);


  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    setVis(['sat-dots'], activeLayers.satellites);
    setVis(['gdelt-dots'], activeLayers.global_incidents);
    setVis(['jam-fill','jam-label'], activeLayers.gps_jamming);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial'], activeLayers.flights);
    setVis(['fl-private'], activeLayers.private);
    setVis(['fl-jets'], activeLayers.jets);
    setVis(['fl-military'], activeLayers.military);
    setVis(['cctv-glow','cctv-dots','cctv-label'], activeLayers.cctv);
  useEffect(() => { setVis(['shodan-glow','shodan-dots','shodan-label'], activeLayers.shodan); }, [mapReady, activeLayers.shodan, setVis]);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-glow','weather-dots','weather-label'], activeLayers.weather);
    setVis(['infra-glow','infra-dots','infra-label'], activeLayers.infrastructure);
    setVis(['maritime-glow','maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-glow','choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-dots','ship-label'], activeLayers.maritime);
    setVis(['news-glow','news-dots','news-label'], activeLayers.live_news);
    setVis(['sigint-news-glow','sigint-news-dots','sigint-news-label'], activeLayers.news_intel);
    setVis(['conflict-icons'], activeLayers.conflict_zones !== false);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['rad-glow','rad-dots','rad-label'], activeLayers.radiation);
    setVis(['milsat-glow','milsat-dots','milsat-label'], activeLayers.mil_satellites);
    setVis(['notam-fill','notam-border','notam-label'], activeLayers.notam);
    setVis(['mil-base-glow','mil-base-dots','mil-base-label'], activeLayers.military_bases);
    setVis(['sigint-glow','sigint-dots','sigint-label'], activeLayers.sigint);
    setVis(['apt-glow','apt-dots','apt-label'], activeLayers.apt_groups);
    setVis(['spyware-glow','spyware-dots','spyware-label'], activeLayers.spyware_infra);
    setVis(['ripe-dots'], activeLayers.ripe_atlas);
    setVis(['device-heat','device-core'], activeLayers.device_heatmap);
    setVis(['volcano-glow','volcano-dots','volcano-label'], activeLayers.volcanoes);
    setVis(['storm-glow','storm-dots','storm-label'], activeLayers.storms);
    setVis(['conflict-event-glow','conflict-event-dots'], activeLayers.conflicts);
    setVis(['outage-glow','outage-dots','outage-label'], activeLayers.internet_outages);
    setVis(['cable-glow','cable-dots'], activeLayers.submarine_cables);
    setVis(['humanitarian-glow','humanitarian-dots'], activeLayers.humanitarian);
    // Sweep layers always visible when data is present (controlled by useEffect)
    setVis(['sweep-connections','sweep-pulse-ring','sweep-device-glow','sweep-device-dots','sweep-device-labels'], true);
  }, [mapReady, activeLayers, setVis]);

  // IP Sweep visualization
  useEffect(() => {
    if (!mapReady) return;
    if (!sweepData?.devices?.length) {
      setGeo('ip-sweep-devices', []);
      setGeo('ip-sweep-pulse', []);
      setGeo('ip-sweep-connections', []);
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const { center, devices } = sweepData;
    const centerCoord: [number, number] = [center.lng, center.lat];

    // Switch to globe and fly to the sweep location
    try {
      (map as any).setProjection({ type: 'globe' });
      map.setSky({ 'sky-color': '#0A0A0F', 'sky-horizon-blend': 0.02, 'horizon-color': '#0A0A0F', 'horizon-fog-blend': 0.02 });
    } catch { /* projection may not be supported */ }

    map.flyTo({ center: centerCoord, zoom: 14, pitch: 50, bearing: -20, duration: 3000, essential: true });

    // Set center pulse
    setGeo('ip-sweep-pulse', [{
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centerCoord },
      properties: { ip: sweepData.target_ip },
    }]);

    // Build device features spread in a circle around center
    const allDeviceFeatures = devices.map((d: any, i: number) => {
      const angle = (i / devices.length) * Math.PI * 2;
      const radius = 0.001 + ((i % 7 + 1) * 0.0004);
      const dLng = centerCoord[0] + Math.cos(angle) * radius * (1 / Math.cos(center.lat * Math.PI / 180));
      const dLat = centerCoord[1] + Math.sin(angle) * radius;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [dLng, dLat] },
        properties: {
          ip: d.ip, device_type: d.device_type, device_icon: d.device_icon,
          color: d.device_color, risk_level: d.risk_level,
          ports: JSON.stringify(d.ports), hostnames: JSON.stringify(d.hostnames),
          vulns: JSON.stringify(d.vulns), cpes: JSON.stringify(d.cpes), tags: JSON.stringify(d.tags),
        },
      };
    });

    // Connection lines from center to each device
    const connectionFeatures = allDeviceFeatures.map((f: any) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [centerCoord, f.geometry.coordinates] },
      properties: { color: f.properties.color },
    }));

    // Stagger the appearance after 3s flyTo completes
    const timer = setTimeout(() => {
      setGeo('ip-sweep-connections', connectionFeatures);
      const batchSize = 5;
      const batches = Math.ceil(allDeviceFeatures.length / batchSize);
      for (let b = 0; b < batches; b++) {
        setTimeout(() => {
          setGeo('ip-sweep-devices', allDeviceFeatures.slice(0, (b + 1) * batchSize));
        }, b * 100);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [mapReady, sweepData, setGeo]);

  // Scan Targets visualization
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanTargets) return;
    const map = mapRef.current;
    
    const features = scanTargets.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      properties: { ...t }
    }));
    
    const src = map.getSource('scan-targets') as maplibregl.GeoJSONSource;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, [scanTargets, mapReady]);

  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: 8, duration: 2000 });
  }, [mapReady, flyToLocation]);

  // Dynamic projection switching (lightweight — no terrain DEM)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      (map as any).setProjection({ type: projection });
      if (projection === 'globe') {
        map.easeTo({ pitch: 20, duration: 1200 });
        try {
          (map as any).setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        map.easeTo({ pitch: 0, duration: 800 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection]);

  // Satellite / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (mapStyle === prevStyleRef.current) return;
    prevStyleRef.current = mapStyle;
    const map = mapRef.current;

    try {
      if (mapStyle !== 'dark') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, 'day-night-fill');
        } else {
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
}

export default memo(OsirisMap);
