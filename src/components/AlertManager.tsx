"use client";
import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Clock } from "lucide-react";

export default function AlertManager() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [interval, setInterval] = useState("3600");

  const load = async () => {
    try { const r = await fetch("/api/alerts"); const d = await r.json(); setAlerts(d.alerts||[]); } catch {}
    setLoading(false);
  };
  useEffect(()=>{ load(); }, []);

  const create = async () => {
    if (!name || !query) return;
    await fetch("/api/alerts", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,query,interval:parseInt(interval)})});
    setName(""); setQuery(""); setShowForm(false);
    load();
  };

  const remove = async (id: string) => { await fetch("/api/alerts?id="+id, {method:"DELETE"}); load(); };
  const toggle = async (id: string, enabled: boolean) => {
    await fetch("/api/alerts", {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id, enabled})});
    load();
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Bell size={16} className="text-[#FF9500]"/>
        <span className="text-xs font-bold text-[#FF9500] tracking-wider">ALERT SYSTEM</span>
        <div className="flex-1"/>
        <button onClick={()=>setShowForm(!showForm)} className="text-white/50 hover:text-white"><Plus size={14}/></button>
      </div>
      {showForm && (
        <div className="p-3 border-b border-white/10 space-y-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Alert name" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#FF9500]"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Shodan query (e.g. port:8080 country:DE)" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#FF9500]"/>
          <div className="flex gap-2 items-center">
            <span className="text-[10px] text-white/50">Interval (s):</span>
            <input value={interval} onChange={e=>setInterval(e.target.value)} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none"/>
            <button onClick={create} className="bg-[#FF9500] text-black text-xs px-3 py-1 rounded font-bold ml-auto">CREATE</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && <Loader2 className="animate-spin mx-auto mt-4" size={16}/>}
        {!loading && alerts.length===0 && <div className="text-white/30 text-xs text-center py-8">No alerts configured</div>}
        {alerts.map(a => (
          <div key={a.id} className="border border-white/10 rounded p-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex-1 truncate">{a.name}</span>
              <button onClick={()=>toggle(a.id,!a.disabled)} className="text-white/50">
                {a.enabled ? <ToggleRight size={16} className="text-[#76FF03]"/> : <ToggleLeft size={16} className="text-white/30"/>}
              </button>
              <button onClick={()=>remove(a.id)} className="text-white/50 hover:text-red-400"><Trash2 size={12}/></button>
            </div>
            <div className="text-[10px] text-white/30 truncate">{a.query}</div>
            <div className="flex gap-2 text-[10px] text-white/20">
              <span className="flex items-center gap-1"><Clock size={8}/> {a.interval}s</span>
              {a.lastCheck && <span>Last: {new Date(a.lastCheck).toLocaleString()}</span>}
              {a.lastResultCount !== undefined && <span className="text-[#00E5FF]">{a.lastResultCount} hits</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
