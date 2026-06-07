import { NextResponse } from "next/server";
import { RECON_TARGETS } from "@/data/recon-targets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const country = searchParams.get("country");
  const category = searchParams.get("category");

  let filtered = RECON_TARGETS;

  if (type) {
    filtered = filtered.filter((t) => t.type === type);
  }
  if (country) {
    filtered = filtered.filter((t) => t.country?.toLowerCase().includes(country.toLowerCase()));
  }
  if (category) {
    filtered = filtered.filter((t) => t.category?.toLowerCase().includes(category.toLowerCase()));
  }

  return NextResponse.json({
    targets: filtered,
    total: filtered.length,
    filters: { type, country, category },
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
