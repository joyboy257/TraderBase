import { NextRequest, NextResponse } from "next/server";
import { runMonitorCycle } from "@/lib/sltp/monitor";

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET header
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[SLTP Cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace(/^Bearer /i, "").trim();

  if (!providedSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMonitorCycle();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[SLTP Cron] runMonitorCycle threw:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
