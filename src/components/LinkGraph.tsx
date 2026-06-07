"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Network, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Node { id: string; label: string; type: string; x: number; y: number; vx: number; vy: number; }
interface Edge { source: string; target: string; label?: string; }

const typeColors: Record<string,string> = {ip:"#00E5FF",org:"#8B00FF",location:"#FFD700",camera:"#FF4500",domain:"#448AFF",recon:"#FF0000"};

export default function LinkGraph({ seedIp, onClose }: { seedIp?: string; onClose?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(seedIp || "");
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{node:Node|null; offsetX:number; offsetY:number}>({node:null,offsetX:0,offsetY:0});
  const animRef = useRef<number>(0);

  const buildGraph = useCallback((ip: string) => {
    setLoading(true);
    // Build a simple graph from the IP
    const newNodes: Node[] = [
      {id:ip,label:ip,type:"ip",x:400,y:300,vx:0,vy:0},
      {id:ip+"_org",label:"Org: "+ip,type:"org",x:500,y:200,vx:0,vy:0},
      {id:ip+"_loc",label:"Location",type:"location",x:300,y:200,vx:0,vy:0},
      {id:ip+"_cam1",label:"Camera 1",type:"camera",x:550,y:350,vx:0,vy:0},
      {id:ip+"_cam2",label:"Camera 2",type:"camera",x:250,y:350,vx:0,vy:0},
      {id:ip+"_recon",label:"Nearby Target",type:"recon",x:400,y:450,vx:0,vy:0},
    ];
    const newEdges: Edge[] = [
      {source:ip,target:ip+"_org",label:"belongs to"},
      {source:ip,target:ip+"_loc",label:"located in"},
      {source:ip,target:ip+"_cam1",label:"same subnet"},
      {source:ip,target:ip+"_cam2",label:"same subnet"},
      {source:ip,target:ip+"_recon",label:"nearby"},
    ];
    setNodes(newNodes);
    setEdges(newEdges);
    setLoading(false);
  }, []);

  useEffect(() => { if (seedIp) buildGraph(seedIp); }, [seedIp, buildGraph]);

  // Force simulation + render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let simNodes = nodes.map(n => ({...n}));
    const simEdges = edges;

    const simulate = () => {
      // Simple force simulation
      const centerX = canvas.width/2, centerY = canvas.height/2;
      for (const n of simNodes) {
        // Center gravity
        n.vx += (centerX - n.x) * 0.001;
        n.vy += (centerY - n.y) * 0.001;
        // Repulsion
        for (const m of simNodes) {
          if (n === m) continue;
          const dx = n.x - m.x, dy = n.y - m.y;
          const dist = Math.max(1, Math.sqrt(dx*dx+dy*dy));
          n.vx += dx/dist * 0.5;
          n.vy += dy/dist * 0.5;
        }
      }
      // Attraction along edges
      for (const e of simEdges) {
        const s = simNodes.find(n=>n.id===e.source);
        const t = simNodes.find(n=>n.id===e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.max(1, Math.sqrt(dx*dx+dy*dy));
        s.vx += dx * 0.003;
        s.vy += dy * 0.003;
        t.vx -= dx * 0.003;
        t.vy -= dy * 0.003;
      }
      // Apply velocity + damping
      for (const n of simNodes) {
        n.x += n.vx; n.y += n.vy;
        n.vx *= 0.9; n.vy *= 0.9;
        // Bounds
        n.x = Math.max(30, Math.min(canvas.width-30, n.x));
        n.y = Math.max(30, Math.min(canvas.height-30, n.y));
      }

      // Render
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(zoom, zoom);

      // Draw edges
      for (const e of simEdges) {
        const s = simNodes.find(n=>n.id===e.source);
        const t = simNodes.find(n=>n.id===e.target);
        if (!s || !t) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      }

      // Draw nodes
      for (const n of simNodes) {
        const color = typeColors[n.type] || "#fff";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.type==="ip"?10:7, 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "9px monospace"; ctx.textAlign = "center";
        ctx.fillText(n.label.length>15?n.label.slice(0,15)+"..":n.label, n.x, n.y-12);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, zoom]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Network size={16} className="text-[#8B00FF]"/>
        <span className="text-xs font-bold text-[#8B00FF] tracking-wider">LINK ANALYSIS</span>
        <div className="flex-1"/>
        <button onClick={()=>setZoom(z=>Math.min(3,z+0.2))} className="text-white/50 hover:text-white"><ZoomIn size={12}/></button>
        <button onClick={()=>setZoom(z=>Math.max(0.3,z-0.2))} className="text-white/50 hover:text-white ml-1"><ZoomOut size={12}/></button>
        {onClose && <button onClick={onClose} className="text-white/50 hover:text-white text-xs ml-2">✕</button>}
      </div>
      <div className="flex gap-2 p-3 border-b border-white/10">
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buildGraph(query)}
          placeholder="Seed IP or entity..." className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#8B00FF]"/>
        <button onClick={()=>buildGraph(query)} disabled={loading} className="bg-[#8B00FF] hover:bg-[#8B00FF]/80 disabled:opacity-50 text-white text-xs px-3 py-1 rounded font-bold">
          {loading ? <Loader2 size={12} className="animate-spin"/> : "BUILD"}
        </button>
      </div>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} width={800} height={600} className="w-full h-full" />
        {nodes.length === 0 && !loading && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">Enter a seed entity to build the link graph</div>}
      </div>
      <div className="flex gap-2 p-2 border-t border-white/10 text-[9px]">
        {Object.entries(typeColors).map(([t,c]) => <span key={t} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor:c}}/>{t}</span>)}
      </div>
    </div>
  );
}
