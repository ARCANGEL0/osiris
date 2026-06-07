"use client";
import { useState, useEffect } from "react";
import { Layers, Loader2, ChevronDown, ChevronUp, Wifi, Globe, Server } from "lucide-react";

const typeIcons: Record<string,any> = {organization: Wifi, feed_url_pattern: Layers, country: Globe, port: Server};
const typeColors: Record<string,string> = {organization:"#00E5FF",feed_url_pattern:"#448AFF",country:"#FFD700",port:"#FF4500"};

export default function PatternViewer() {
  const [patterns, setPatterns] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/patterns").then(r=>r.json()).then(d=>{setPatterns(d);setLoading(false);}).catch(()=>setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-white/30"><Loader2 className="animate-spin" size={16}/></div>;
  if (!patterns) return <div className="text-white/30 text-xs p-3">No patterns loaded</div>;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Layers size={16} className="text-[#448AFF]"/>
        <span className="text-xs font-bold text-[#448AFF] tracking-wider">PATTERN DETECTION</span>
        <span className="text-[10px] text-white/30 ml-auto">{patterns.totalClusters} clusters</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {patterns.clusters?.map((c: any, i: number) => {
          const Icon = typeIcons[c.type] || Layers;
          const color = typeColors[c.type] || "#fff";
          const isOpen = expanded === i+"";
          return (
            <div key={i} className="border border-white/10 rounded overflow-hidden">
              <button onClick={()=>setExpanded(isOpen?null:i+"")} className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-xs">
                <Icon size={12} style={{color}}/>
                <span className="flex-1 text-left truncate text-white">{c.pattern}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10" style={{color}}>{c.count}</span>
                {isOpen ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
              </button>
              {isOpen && (
                <div className="p-2 bg-black/30 text-[11px] space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">Type</span><span>{c.type}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Count</span><span style={{color}}>{c.count}</span></div>
                  {c.countries && <div className="flex justify-between"><span className="text-white/50">Countries</span><span>{c.countries.join(", ")}</span></div>}
                  {c.samples && <div className="mt-1 text-white/30">Sample IPs: {c.samples.map((s:any)=>s.ip).join(", ")}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
