import { NextRequest, NextResponse } from "next/server";
import { getShodanKey } from "@/lib/shodanKeys";
import { RECON_TARGETS } from "@/data/recon-targets";
import dns from "dns";
import { promisify } from "util";
const dnsReverse = promisify(dns.reverse);
const dnsResolve = promisify(dns.resolve);
function isIP(s: string) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[a-fA-F0-9:]+$/.test(s); }
function isDomain(s: string) { return /^[a-zA-Z0-9][a-zA-Z0-9\-]*(\.[a-zA-Z]{2,})+$/.test(s); }
async function shodanHost(ip: string) {
  const key = getShodanKey(); if (!key) return null;
  try { const r = await fetch("https://api.shodan.io/shodan/host/" + ip + "?key=***" + key, {signal: AbortSignal.timeout(10000)}); return r.ok ? r.json() : null; } catch { return null; }
}
async function shodanOrg(org: string) {
  const key = getShodanKey(); if (!key) return null;
  try { const r = await fetch("https://api.shodan.io/shodan/host/search?key=***" + key + "&query=org:%22" + encodeURIComponent(org) + "%22&limit=10", {signal: AbortSignal.timeout(10000)}); return r.ok ? r.json() : null; } catch { return null; }
}
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({error:"Missing query"},{status:400});
  const d: any = {query:q, type:null, data:{}};
  if (isIP(q)) {
    d.type = "ip";
    const sd = await shodanHost(q);
    if (sd) d.data.shodan = {ip:sd.ip_str,org:sd.org,isp:sd.isp,os:sd.os,ports:sd.ports,hostnames:sd.hostnames,vulns:sd.vulns,city:sd.city,country:sd.country_name,location:{lat:sd.latitude,lng:sd.longitude},last_update:sd.last_update,tags:sd.tags,dataCount:sd.data?.length||0};
    try { d.data.reverseDNS = await dnsReverse(q); } catch { d.data.reverseDNS = []; }
  }
  if (isDomain(q)) {
    d.type = "domain";
    const dr: any = {};
    for (const t of ["A","AAAA","MX","NS","TXT","CNAME"]) {
      try { dr[t] = t==="MX" ? (await dnsResolve(q,t) as any[]).map((r:any)=>typeof r==="object"?r.exchange+" (pri:"+r.priority+")":r) : await dnsResolve(q,t); } catch { dr[t] = []; }
    }
    d.data.dns = dr;
  }
  if (q.length > 2) {
    d.type = d.type || "general";
    const ql = q.toLowerCase();
    const rm = RECON_TARGETS.filter(t=>t.name.toLowerCase().includes(ql)||t.city.toLowerCase().includes(ql)||t.country.toLowerCase().includes(ql)||t.branch.toLowerCase().includes(ql)||t.category.toLowerCase().includes(ql)).slice(0,20);
    if (rm.length>0) d.data.recon = rm;
    if (!isIP(q)) {
      const o = await shodanOrg(q);
      if (o?.matches?.length) d.data.shodanOrg = {total:o.total, matches:o.matches.slice(0,10).map((m:any)=>({ip:m.ip_str,org:m.org,port:m.port,city:m.location?.city,country:m.location?.country_name,hostnames:m.hostnames}))};
    }
  }
  return NextResponse.json(d);
}
