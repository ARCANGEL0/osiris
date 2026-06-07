"use client";
import { useState } from "react";
import { Radar, Loader2, Play, Download, Trash2, Plus } from "lucide-react";

export default function BulkScanner() {
  const [queries, setQueries] = useState<string[]>(["port:8080 country:DE", "port:22 country:US", "apache country:BR"]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({done:0,total:0});
  const [newQuery, setNewQuery] = useState("");

  const addQuery = () => { if(newQuery.trim()) { setQueries(q=>[...q,newQuery.trim()]); setNewQuery(""); } };
  const removeQuery = (i: number) => setQueries(q=>q.filter((_,j)=>j!==i));

  const runAll = async () => {
    setLoading(true); setResults([]); setProgress({done:0,total:queries.length});
    const allResults: any[] = [];
    for (let i = 0; i < queries.length; i++) {
      try {
        const r = await fetch("/api/shodan/search?query="+encodeURIComponent(queries[i])+"&limit=100");
        const d = await r.json();
        allResults.push({query: queries[i], matches: d.matches||[], total: d.total||0, error: null});
      } catch(e: any) {
        allResults.push({query: queries[i], matches:[], total:0, error: e.message});
      }
      setProgress({done:i+1, total:queries.length});
    }
    setResults(allResults);
    setLoading(false);
  };

  const exportCSV = () => {
    const esc = (v: any) => '"'+String(v).replace(/"/g,'""')+'"';
    const rows = [["Query","IP","Org","Port","Country","City"].map(esc).join(",")];
    for (const r of results) {
      for (const m of (r.matches||[])) {
        rows.push([r.query, m.ip_str, m.org||"", m.port+"", m.location?.country_name||"", m.location?.city||""].map(esc).join(","));
      }
    }
    const blob = new Blob([rows.join("\n")],{type:"text/csv"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="bulk-scan.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(results,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="bulk-scan.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const totalMatches = results.reduce((s,r)=>s+(r.total||0),0);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Radar size={16} className="text-[#FF3D3D]"/>
        <span className="text-xs font-bold text-[#FF3D3D] tracking-wider">BULK SHODAN SCANNER</span>
        <div className="flex-1"/>
        {results.length>0 && <>
          <button onClick={exportCSV} className="text-white/50 hover:text-white text-[10px] flex items-center gap-1"><Download size={10}/> CSV</button>
          <button onClick={exportJSON} className="text-white/50 hover:text-white text-[10px] flex items-center gap-1 ml-2"><Download size={10}/> JSON</button>
        </>}
      </div>
      <div className="p-3 border-b border-white/10 space-y-2">
        <div className="flex gap-2">
          <input value={newQuery} onChange={e=>setNewQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuery()}
            placeholder="Add Shodan query..." className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#FF3D3D]"/>
          <button onClick={addQuery} className="text-white/50 hover:text-white"><Plus size={14}/></button>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {queries.map((q,i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] bg-white/5 rounded px-2 py-1">
              <span className="flex-1 truncate text-white">{q}</span>
              <button onClick={()=>removeQuery(i)} className="text-white/30 hover:text-red-400"><Trash2 size={10}/></button>
            </div>
          ))}
        </div>
        <button onClick={runAll} disabled={loading||queries.length===0} className="w-full bg-[#FF3D3D] hover:bg-[#FF3D3D]/80 disabled:opacity-50 text-white text-xs py-1.5 rounded font-bold flex items-center justify-center gap-1">
          {loading ? <><Loader2 size={12} className="animate-spin"/> {progress.done}/{progress.total}</> : <><Play size={12}/> RUN ALL</>}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {results.length===0 && !loading && <div className="text-white/30 text-xs text-center py-8">Add queries and run bulk scan</div>}
        {results.map((r,i) => (
          <div key={i} className="border border-white/10 rounded overflow-hidden">
            <div className="flex items-center gap-2 p-2 bg-white/5 text-xs">
              <span className="flex-1 truncate text-white font-bold">{r.query}</span>
              <span className="text-[#00E5FF]">{r.total||0} results</span>
              {r.error && <span className="text-red-400 text-[10px]">Error</span>}
            </div>
            <div className="p-1.5 bg-black/30 max-h-32 overflow-y-auto">
              {(r.matches||[]).slice(0,10).map((m:any,j:number) => (
                <div key={j} className="text-[10px] flex justify-between py-0.5">
                  <span className="text-[#00E5FF]">{m.ip_str}</span>
                  <span className="text-white/30">port {m.port} · {m.location?.country_name||"?"}</span>
                </div>
              ))}
              {(r.matches||[]).length>10 && <div className="text-[10px] text-white/20 text-center">+{(r.matches||[]).length-10} more</div>}
            </div>
          </div>
        ))}
      </div>
      {results.length>0 && <div className="p-2 border-t border-white/10 text-[10px] text-white/30 text-center">Total: {totalMatches} matches across {results.length} queries</div>}
    </div>
  );
}
