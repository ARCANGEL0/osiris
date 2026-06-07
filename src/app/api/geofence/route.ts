import { NextRequest, NextResponse } from "next/server";
import { RECON_TARGETS } from "@/data/recon-targets";
import { SHODAN_CAMERAS } from "@/data/shodan-camera-data";
function pip(lat:number,lng:number,poly:number[][]) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const yi=poly[i][0],xi=poly[i][1],yj=poly[j][0],xj=poly[j][1];
    if(((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
export async function POST(req: Request) {
  const body = await req.json();
  const polygon: number[][] = body.polygon;
  const types: string[] = body.types||["recon","cameras"];
  if(!polygon||polygon.length<3) return NextResponse.json({error:"Need 3+ points"},{status:400});
  const r:any={polygon,entities:[],totalEntities:0};
  if(types.includes("recon")) { const ins=RECON_TARGETS.filter(t=>pip(t.lat,t.lng,polygon)); r.entities.push({type:"recon",count:ins.length,items:ins}); }
  if(types.includes("cameras")) { const cams=SHODAN_CAMERAS||[]; const ins=cams.filter(c=>c.lat&&c.lng&&pip(c.lat,c.lng,polygon)); r.entities.push({type:"cameras",count:ins.length,items:ins.slice(0,100)}); }
  r.totalEntities=r.entities.reduce((s:number,e:any)=>s+e.count,0);
  return NextResponse.json(r);
}
