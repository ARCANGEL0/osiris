import { NextRequest, NextResponse } from "next/server";
import { SHODAN_CAMERAS } from "@/data/shodan-camera-data";
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type")||"all";
  const p: any = {type, clusters:[], totalClusters:0};
  const cams = SHODAN_CAMERAS||[];
  if (type==="all"||type==="org") {
    const g: Record<string,any[]> = {};
    for (const c of cams) { const o=c.org||"Unknown"; (g[o]=g[o]||[]).push(c); }
    p.clusters.push(...Object.entries(g).filter(([,c])=>c.length>=5).sort((a,b)=>b[1].length-a[1].length).slice(0,20).map(([org,c])=>({pattern:org,type:"organization",count:c.length,countries:[...new Set(c.map(x=>x.country))].slice(0,5),samples:c.slice(0,3).map(x=>({ip:x.ip,city:x.city,country:x.country}))})));
  }
  if (type==="all"||type==="feed_pattern") {
    const g: Record<string,any[]> = {};
    for (const c of cams) { try { const path=new URL(c.feed_url||c.stream_url||"").pathname; (g[path]=g[path]||[]).push(c); } catch {} }
    p.clusters.push(...Object.entries(g).filter(([,c])=>c.length>=10).sort((a,b)=>b[1].length-a[1].length).slice(0,15).map(([path,c])=>({pattern:path,type:"feed_url_pattern",count:c.length,countries:[...new Set(c.map(x=>x.country))].slice(0,5)})));
  }
  if (type==="all"||type==="country") {
    const g: Record<string,number> = {};
    for (const c of cams) g[c.country]=(g[c.country]||0)+1;
    p.clusters.push(...Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([country,count])=>({pattern:country,type:"country",count})));
  }
  if (type==="all"||type==="port") {
    const g: Record<number,any[]> = {};
    for (const c of cams) { try { const u=new URL(c.feed_url||c.stream_url||""); const pt=u.port?parseInt(u.port):(u.protocol==="https:"?443:80); (g[pt]=g[pt]||[]).push(c); } catch {} }
    p.clusters.push(...Object.entries(g).sort((a,b)=>b[1].length-a[1].length).slice(0,10).map(([port,c])=>({pattern:"Port "+port,type:"port",count:c.length,countries:[...new Set(c.map(x=>x.country))].slice(0,3)})));
  }
  p.totalClusters = p.clusters.length;
  return NextResponse.json(p);
}
