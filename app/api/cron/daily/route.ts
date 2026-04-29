import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngestion({ sources: ["luma", "web"] });

    return NextResponse.json({
      lumaResult: result.lumaResult,
      webResult: result.webResult,
      totalCreated: result.totalCreated,
      totalUpdated: result.totalUpdated,
      duration: result.duration,
    });
  } catch (error) {
    console.error("POST /api/cron/daily error:", error);
    return NextResponse.json(
      { error: "Cron ingestion failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
