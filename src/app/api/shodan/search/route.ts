import { NextResponse } from "next/server";
import { getShodanKey } from "@/lib/shodanKeys";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  const key = getShodanKey();
  if (!key) {
    return NextResponse.json({ error: "No Shodan API key configured" }, { status: 503 });
  }

  try {
    const url = "https://api.shodan.io/shodan/host/search?key=" + key + "&query=" + encodeURIComponent(query) + "&page=" + page;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Shodan API error: " + res.status }, { status: res.status });
    }

    const data = await res.json();

    const matches = (data.matches || []).map((m: any) => ({
      ip: m.ip_str,
      port: m.port,
      hostnames: m.hostnames || [],
      org: m.org || "",
      city: m.location?.city || "",
      country: m.location?.country_name || "",
      lat: m.location?.latitude,
      lng: m.location?.longitude,
      os: m.os || "",
      product: m.product || "",
      title: m.http?.title || "",
      data: (m.data || "").substring(0, 500),
      timestamp: m.timestamp || "",
      vulns: m.vulns || [],
      tags: m.tags || [],
      has_screenshot: !!m.has_screenshot,
    }));

    return NextResponse.json({
      matches,
      total: data.total || 0,
      page,
      facets: data.facets || {},
      query,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Shodan search failed" }, { status: 500 });
  }
}
