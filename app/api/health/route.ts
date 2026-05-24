import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Lightweight health check — used by Netlify, uptime monitors, and CI.
 * Intentionally unauthenticated; returns 200 when the app + DB are reachable.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "error", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
