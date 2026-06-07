"use client";
import { useState } from "react";
import { GitBranch, Loader2, MapPin, Wifi, Shield, Crosshair } from "lucide-react";

export default function CorrelationPanel({ lat, lng, ip, onClose }: { lat?: number; lng?: number; ip?: string; onClose?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState("50");

  const correlate = async () => {
    setLoading(true); setData(null);
    const params = new URLSearchParams();
    if(lat) params.set("lat", lat.toString());
    if(lng) params.set("lng", lng.toString());
    if(ip) params.set("ip", ip);
    params.set("radius", radius);
    try {
      const r = await fetch("/api/correlate?"+params.toString());
      setData(await r.json());
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <GitBranch size={16} className="text-[#FFD700]"/>
        <span className="text-xs font-bold text-[#FFD700] tracking-wider">CORRELATION ENGINE</span>
        <div className="flex-1"/>
        {onClose && <button onClick={onClose} className="text-white/50 hover:text-white text-xs">✕</button>}
      </div>
      <div className="p-3 border-b border-white/10 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 text-[11px]"><span className="text-white/50">Lat:</span> <span className="text-white">{lat?.toFixed(4) || "—"}</span></div>
          <div className="flex-1 text-[11px]"><span className="text-white/50">Lng:</span> <span className="text-white">{lng?.toFixed(4) || "—"}</span></div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-white/50">IP:</span> <span className="text-[#00E5FF]">{ip || "—"}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[11px] text-white/50">Radius (km):</span>
          <input value={radius} onChange={e=>setRadius(e.target.value)} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#FFD700]"/>
          <button onClick={correlate} disabled={loading || (!lat && !ip)} className="bg-[#FFD700] hover:bg-[#FFD700]/80 disabled:opacity-50 text-black text-xs px-3 py-1 rounded font-bold ml-auto">
            {loading ? <Loader2 size={12} className="animate-spin"/> : "CORRELATE"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!data && !loading && <div className="text-white/30 text-xs text-center py-8">Select a location or IP to find correlations</div>}
        {data?.correlations?.map((c: any, i: number) => (
          <div key={i} className="border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 bg-white/5 text-xs">
              {c.type==="recon_nearby" && <Shield size={12} className="text-[#FF4500]"/>}
              {c.type==="cameras_nearby" && <Wifi size={12} className="text-[#00E5FF]"/>}
              {c.type==="same_org" && <Crosshair size={12} className="text-[#8B00FF]"/>}
              <span className="text-white font-bold">{c.type.replace(/_/g," ")}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 ml-auto">{c.count}</span>
            </div>
            <div className="p-2 space-y-1 bg-black/30 max-h-40 overflow-y-auto">
              {c.targets?.map((t: any) => (
                <div key={t.id} className="text-[11px] flex justify-between">
                  <span className="text-white">{t.name}</span>
                  <span className="text-white/50">{t.country} · {t.distance?.toFixed(1)}km</span>
                </div>
              ))}
              {c.cameras?.map((c2: any, j: number) => (
                <div key={j} className="text-[11px] flex justify-between">
                  <span className="text-[#00E5FF]">{c2.ip}</span>
                  <span className="text-white/50">port {c2.port||new URL(c2.feed_url||"").port||"80"} · {c2.distance?.toFixed(1)}km</span>
                </div>
              ))}
              {c.matches?.map((m: any, j: number) => (
                <div key={j} className="text-[11px] flex justify-between">
                  <span className="text-[#8B00FF]">{m.ip}</span>
                  <span className="text-white/50">{m.org} · port {m.port}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
