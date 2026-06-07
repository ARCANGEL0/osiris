"use client";
import { useState } from "react";
import { Search, Server, Globe, Shield, MapPin, AlertTriangle, Wifi, Lock, Database, ChevronDown, ChevronUp, Loader2, Crosshair } from "lucide-react";

interface DossierPanelProps { onClose?: () => void; }

export default function DossierPanel({ onClose }: DossierPanelProps) {
  const [query, setQuery] = useState("");
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setDossier(null);
    try {
      const r = await fetch("/api/dossier?q=" + encodeURIComponent(query.trim()));
      const d = await r.json();
      if (d.error) setError(d.error);
      else { setDossier(d); setExpanded({}); }
    } catch { setError("Search failed"); }
    setLoading(false);
  };

  const typeColors: Record<string, string> = { ip: "#00E5FF", domain: "#448AFF", general: "#FFD700" };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Crosshair size={16} className="text-[#FF4500]" />
        <span className="text-xs font-bold text-[#FF4500] tracking-wider">ENTITY DOSSIER</span>
        <div className="flex-1" />
        {onClose && <button onClick={onClose} className="text-white/50 hover:text-white text-xs">✕</button>}
      </div>
      <div className="flex gap-2 p-3 border-b border-white/10">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
          placeholder="IP, domain, name, or org..." className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF4500]" />
        <button onClick={search} disabled={loading} className="bg-[#FF4500] hover:bg-[#FF4500]/80 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-bold">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && <div className="text-red-400 text-xs p-2 bg-red-500/10 rounded">{error}</div>}
        {!dossier && !loading && !error && <div className="text-white/30 text-xs text-center py-8">Search for an IP, domain, or entity name to compile a dossier</div>}
        {dossier && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold" style={{ color: typeColors[dossier.type] || "#fff" }}>{dossier.query}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase">{dossier.type}</span>
            </div>
            {dossier.data?.shodan && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button onClick={() => toggle("shodan")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                  <Server size={12} className="text-[#00E5FF]" /> Shodan Data
                  {expanded.shodan ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
                </button>
                {expanded.shodan && (
                  <div className="p-2 space-y-1 text-[11px] bg-black/30">
                    <div className="flex justify-between"><span className="text-white/50">Org</span><span className="text-white">{dossier.data.shodan.org || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">ISP</span><span className="text-white">{dossier.data.shodan.isp || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">OS</span><span className="text-white">{dossier.data.shodan.os || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Country</span><span className="text-white">{dossier.data.shodan.country || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">City</span><span className="text-white">{dossier.data.shodan.city || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Ports</span><span className="text-[#00E5FF]">{(dossier.data.shodan.ports||[]).join(", ") || "None"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Hostnames</span><span className="text-white">{(dossier.data.shodan.hostnames||[]).join(", ") || "None"}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Tags</span><span className="text-[#FFD700]">{(dossier.data.shodan.tags||[]).join(", ") || "None"}</span></div>
                    {dossier.data.shodan.vulns && Object.keys(dossier.data.shodan.vulns).length > 0 && (
                      <div className="mt-1 p-1.5 bg-red-500/10 rounded text-red-400">
                        <div className="flex items-center gap-1 mb-1"><AlertTriangle size={10} /> {Object.keys(dossier.data.shodan.vulns).length} CVEs detected</div>
                        <div className="text-[10px]">{Object.keys(dossier.data.shodan.vulns).slice(0,5).join(", ")}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {dossier.data?.dns && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button onClick={() => toggle("dns")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                  <Globe size={12} className="text-[#448AFF]" /> DNS Records
                  {expanded.dns ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
                </button>
                {expanded.dns && (
                  <div className="p-2 space-y-1 text-[11px] bg-black/30">
                    {Object.entries(dossier.data.dns).map(([type, vals]: any) => vals.length > 0 && (
                      <div key={type}><span className="text-[#448AFF] font-bold">{type}</span>: {vals.join(", ")}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {dossier.data?.recon && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button onClick={() => toggle("recon")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                  <Shield size={12} className="text-[#FF4500]" /> Recon Targets ({dossier.data.recon.length})
                  {expanded.recon ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
                </button>
                {expanded.recon && (
                  <div className="p-2 space-y-1 bg-black/30">
                    {dossier.data.recon.map((t: any) => (
                      <div key={t.id} className="text-[11px] p-1.5 bg-white/5 rounded flex justify-between">
                        <span className="text-white font-bold">{t.name}</span>
                        <span className="text-white/50">{t.country} · {t.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {dossier.data?.shodanOrg && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button onClick={() => toggle("org")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                  <Wifi size={12} className="text-[#8B00FF]" /> Shodan Org Matches ({dossier.data.shodanOrg.total})
                  {expanded.org ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
                </button>
                {expanded.org && (
                  <div className="p-2 space-y-1 bg-black/30">
                    {dossier.data.shodanOrg.matches.map((m: any, i: number) => (
                      <div key={i} className="text-[11px] p-1.5 bg-white/5 rounded flex justify-between">
                        <span className="text-[#8B00FF]">{m.ip}</span>
                        <span className="text-white/50">port {m.port} · {m.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {dossier.data?.reverseDNS && dossier.data.reverseDNS.length > 0 && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button onClick={() => toggle("rdns")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                  <MapPin size={12} className="text-[#76FF03]" /> Reverse DNS
                  {expanded.rdns ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
                </button>
                {expanded.rdns && <div className="p-2 text-[11px] bg-black/30 text-[#76FF03]">{dossier.data.reverseDNS.join(", ")}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
