"use client";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";

const levelColors: Record<string,string> = {LOW:"#76FF03",ELEVATED:"#FFD700",MEDIUM:"#FF9500",HIGH:"#FF4500",CRITICAL:"#FF0000"};
const levelAngles: Record<string,number> = {LOW:135,ELEVATED:180,MEDIUM:225,HIGH:270,CRITICAL:315};

export default function ThreatGauge({ ip, onClose }: { ip?: string; onClose?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customIp, setCustomIp] = useState(ip || "");

  const analyze = async (targetIp: string) => {
    if (!targetIp) return;
    setLoading(true); setError(""); setData(null);
    try {
      const r = await fetch("/api/threat-score?ip=" + encodeURIComponent(targetIp));
      const d = await r.json();
      if (d.error) setError(d.error); else setData(d);
    } catch { setError("Analysis failed"); }
    setLoading(false);
  };

  useEffect(() => { if (ip) analyze(ip); }, [ip]);

  const score = data?.score || 0;
  const level = data?.level || "LOW";
  const color = levelColors[level] || "#76FF03";
  const angle = levelAngles[level] || 135;
  const rad = (angle - 90) * Math.PI / 180;
  const needleX = 60 + 40 * Math.cos(rad);
  const needleY = 60 + 40 * Math.sin(rad);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Shield size={16} style={{color}} />
        <span className="text-xs font-bold tracking-wider" style={{color}}>THREAT SCORE</span>
        <div className="flex-1" />
        {onClose && <button onClick={onClose} className="text-white/50 hover:text-white text-xs">✕</button>}
      </div>
      <div className="flex gap-2 p-3 border-b border-white/10">
        <input value={customIp} onChange={e=>setCustomIp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&analyze(customIp)}
          placeholder="Enter IP address..." className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF4500]" />
        <button onClick={()=>analyze(customIp)} disabled={loading} className="bg-[#FF4500] hover:bg-[#FF4500]/80 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-bold">
          {loading ? <Loader2 size={12} className="animate-spin" /> : "SCAN"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {error && <div className="text-red-400 text-xs p-2 bg-red-500/10 rounded">{error}</div>}
        {!data && !loading && !error && <div className="text-white/30 text-xs text-center py-8">Enter an IP to calculate threat score</div>}
        {data && (
          <>
            <svg viewBox="0 0 120 80" className="w-48 h-32 mb-4">
              <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="#333" strokeWidth="8" strokeLinecap="round" />
              <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={""+score * 2.51+" 251"} />
              <line x1="60" y1="60" x2={needleX} y2={needleY} stroke={color} strokeWidth="2" />
              <circle cx="60" cy="60" r="4" fill={color} />
              <text x="60" y="50" textAnchor="middle" fill={color} fontSize="16" fontWeight="bold">{score}</text>
              <text x="60" y="75" textAnchor="middle" fill="#666" fontSize="8">/100</text>
            </svg>
            <div className="text-center mb-4">
              <div className="text-lg font-bold" style={{color}}>{level}</div>
              <div className="text-[10px] text-white/50">{data.ip} · {data.org || "Unknown org"}</div>
            </div>
            <div className="w-full space-y-2">
              {data.breakdown && Object.entries(data.breakdown).map(([key, val]: any) => (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="text-white/50 w-28 capitalize">{key.replace(/([A-Z])/g, " ").trim()}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width: (val.score/val.max*100)+"%", backgroundColor: val.score/val.max > 0.6 ? "#FF4500" : val.score/val.max > 0.3 ? "#FFD700" : "#76FF03"}} />
                  </div>
                  <span className="text-white/70 w-8 text-right">{val.score}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
