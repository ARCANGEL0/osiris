"use client";
import { useState, useCallback } from "react";
import { MapPinned, Loader2, Trash2, Shield, Wifi } from "lucide-react";

interface GeofenceToolProps {
  mapRef?: any;
  onResults?: (results: any) => void;
}

export default function GeofenceTool({ onResults }: GeofenceToolProps) {
  const [points, setPoints] = useState<[number,number][]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  const addPoint = useCallback((lat: number, lng: number) => {
    setPoints(p => [...p, [lat, lng]]);
  }, []);

  const clear = () => { setPoints([]); setResults(null); setActive(false); };

  const search = async () => {
    if (points.length < 3) return;
    setLoading(true);
    try {
      const r = await fetch("/api/geofence", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({polygon:points, types:["recon","cameras"]})});
      const d = await r.json();
      setResults(d);
      onResults?.(d);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <MapPinned size={16} className="text-[#76FF03]"/>
        <span className="text-xs font-bold text-[#76FF03] tracking-wider">GEOFENCE</span>
        <div className="flex-1"/>
        <button onClick={clear} className="text-white/50 hover:text-white text-xs"><Trash2 size={12}/></button>
      </div>
      <div className="p-3 border-b border-white/10 space-y-2 text-[11px]">
        <p className="text-white/50">Click on the map to add polygon points (min 3)</p>
        <div className="flex gap-2">
          <span className="text-white/50">Points:</span>
          <span className="text-[#76FF03] font-bold">{points.length}</span>
        </div>
        {points.length > 0 && (
          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {points.map((p,i) => (
              <div key={i} className="text-[10px] text-white/30">#{i+1}: {p[0].toFixed(4)}, {p[1].toFixed(4)}</div>
            ))}
          </div>
        )}
        <button onClick={search} disabled={points.length<3 || loading} className="w-full bg-[#76FF03] hover:bg-[#76FF03]/80 disabled:opacity-50 text-black text-xs py-1.5 rounded font-bold">
          {loading ? <Loader2 size={12} className="animate-spin mx-auto"/> : "SEARCH WITHIN POLYGON"}
        </button>
      </div>
      {results && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-xs text-white/50 mb-2">{results.totalEntities} entities found</div>
          {results.entities?.map((e: any, i: number) => (
            <div key={i} className="border border-white/10 rounded overflow-hidden">
              <div className="flex items-center gap-2 p-2 bg-white/5 text-xs">
                {e.type==="recon" ? <Shield size={12} className="text-[#FF4500]"/> : <Wifi size={12} className="text-[#00E5FF]"/>}
                <span className="capitalize">{e.type}</span>
                <span className="ml-auto text-white/50">{e.count}</span>
              </div>
              <div className="p-1.5 bg-black/30 max-h-32 overflow-y-auto">
                {e.items?.slice(0,10).map((item: any, j: number) => (
                  <div key={j} className="text-[10px] text-white/70 py-0.5">{item.name || item.ip} · {item.country}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
