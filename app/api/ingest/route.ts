import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestion";

export const dynamic = "force-dynamic";
// Ingestion can take 10-30s — extend the default timeout
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sources?: string[];
      keywords?: string[];
    };

    const sources = (body.sources ?? ["luma", "web"]).filter(
      (s): s is "luma" | "web" => s === "luma" || s === "web"
    );
    const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : [];

    const result = await runIngestion({ sources, keywords });

    return NextResponse.json({
      lumaResult: result.lumaResult,
      webResult: result.webResult,
      totalCreated: result.totalCreated,
      totalUpdated: result.totalUpdated,
      duration: result.duration,
    });
  } catch (error) {
    console.error("POST /api/ingest error:", error);
    return NextResponse.json(
      { error: "Ingestion failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
