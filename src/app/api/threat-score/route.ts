import { NextRequest, NextResponse } from "next/server";
import { getShodanKey } from "@/lib/shodanKeys";
const HRP = [21,23,25,110,143,3306,3389,5432,5900,6379,8080,8443,9200,27017];
const CP = [23,135,139,445,3389,5900];
const HRC = ["CN","RU","KP","IR","NG","BR"];
async function getSD(ip: string) {
  const key = getShodanKey(); if (!key) return null;
  try { const r = await fetch("https://api.shodan.io/shodan/host/"+ip+"?key=***"+key,{signal:AbortSignal.timeout(10000)}); return r.ok?r.json():null; } catch { return null; }
}
export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get("ip")?.trim();
  if (!ip) return NextResponse.json({error:"Missing IP"},{status:400});
  const sd = await getSD(ip);
  let geo: any = null;
  try { const gr = await fetch("https://ipinfo.io/"+ip+"/json",{signal:AbortSignal.timeout(5000)}); if(gr.ok) geo = await gr.json(); } catch {}
  const ports: number[] = sd?.ports||[];
  const hr = ports.filter(p=>HRP.includes(p));
  const cp = ports.filter(p=>CP.includes(p));
  const ps = Math.min(30, ports.length*2+hr.length*5+cp.length*10);
  const vulns = Object.keys(sd?.vulns||{});
  const vs = Math.min(30, vulns.length*10);
  const cc = sd?.country_code||geo?.country;
  const gs = HRC.includes(cc)?12:5;
  const ds = Math.min(15, Math.floor((sd?.data?.length||0)/5));
  const ss = Math.min(10, (sd?.tags||[]).length*2);
  const score = Math.min(100, ps+vs+gs+ds+ss);
  const level = score>=80?"CRITICAL":score>=60?"HIGH":score>=40?"MEDIUM":score>=20?"ELEVATED":"LOW";
  return NextResponse.json({score,level,ip:sd?.ip_str||ip,org:sd?.org||geo?.org,
    breakdown:{portExposure:{score:ps,max:30,totalPorts:ports.length,highRisk:hr,critical:cp},vulnerabilities:{score:vs,max:30,count:vulns.length,ids:vulns.slice(0,10)},geographicRisk:{score:gs,max:15,country:cc},dataExposure:{score:ds,max:15,bannerCount:sd?.data?.length||0},serviceDiversity:{score:ss,max:10,services:sd?.tags||[]}}
  });
}
