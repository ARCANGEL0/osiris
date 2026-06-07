import { NextRequest, NextResponse } from "next/server";
import { RECON_TARGETS } from "@/data/recon-targets";
import { SHODAN_CAMERAS } from "@/data/shodan-camera-data";
function haversine(lat1:number,lng1:number,lat2:number,lng2:number) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export async function GET(req: NextRequest) {
  const lat=parseFloat(req.nextUrl.searchParams.get("lat")||"0");
  const lng=parseFloat(req.nextUrl.searchParams.get("lng")||"0");
  const radius=parseFloat(req.nextUrl.searchParams.get("radius")||"50");
  const ip=req.nextUrl.searchParams.get("ip")||"";
  const r:any={query:{lat,lng,radiusKm:radius,sourceIP:ip},correlations:[]};
  if(lat&&lng) {
    const nr=RECON_TARGETS.map(t=>({...t,d:haversine(lat,lng,t.lat,t.lng)})).filter(t=>t.d<=radius).sort((a,b)=>a.d-b.d);
    if(nr.length>0) r.correlations.push({type:"recon_nearby",count:nr.length,targets:nr.slice(0,20)});
    const cams=SHODAN_CAMERAS||[];
    const nc=cams.filter(c=>c.lat&&c.lng).map(c=>({...c,d:haversine(lat,lng,c.lat,c.lng)})).filter(c=>c.d<=radius).sort((a,b)=>a.d-b.d);
    if(nc.length>0) r.correlations.push({type:"cameras_nearby",count:nc.length,cameras:nc.slice(0,30)});
  }
  if(ip) {
    const cams=SHODAN_CAMERAS||[];
    const sc=cams.find(c=>c.ip===ip);
    if(sc?.org) { const so=cams.filter(c=>c.org===sc.org&&c.ip!==ip).slice(0,20); if(so.length>0) r.correlations.push({type:"same_org",org:sc.org,count:so.length,matches:so}); }
  }
  r.totalCorrelations=r.correlations.length;
  return NextResponse.json(r);
}
