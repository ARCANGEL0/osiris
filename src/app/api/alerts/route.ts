import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ALERTS_FILE = path.join(process.cwd(), "src/data/alerts.json");

async function loadAlerts(): Promise<any[]> {
  try {
    const data = await fs.readFile(ALERTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch { return []; }
}

async function saveAlerts(alerts: any[]) {
  await fs.mkdir(path.dirname(ALERTS_FILE), { recursive: true });
  await fs.writeFile(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

export async function GET() {
  const alerts = await loadAlerts();
  return NextResponse.json({ alerts, total: alerts.length });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, query, interval, enabled = true } = body;
  if (!name || !query) return NextResponse.json({ error: "Name and query required" }, { status: 400 });
  const alerts = await loadAlerts();
  const newAlert = {
    id: "alert-" + Date.now(),
    name, query, interval: interval || 3600, enabled,
    createdAt: new Date().toISOString(),
    lastCheck: null, lastResultCount: 0, checkCount: 0,
  };
  alerts.push(newAlert);
  await saveAlerts(alerts);
  return NextResponse.json(newAlert);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const alerts = await loadAlerts();
  const filtered = alerts.filter(a => a.id !== id);
  await saveAlerts(filtered);
  return NextResponse.json({ deleted: id, remaining: filtered.length });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, enabled } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const alerts = await loadAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  if (enabled !== undefined) alert.enabled = enabled;
  await saveAlerts(alerts);
  return NextResponse.json(alert);
}
