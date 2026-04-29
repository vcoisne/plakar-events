import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCompetitors } from "@/lib/competitors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const signals = await prisma.competitorSignal.findMany({
      where: { eventId: params.id },
      orderBy: { competitorName: "asc" },
    });
    return NextResponse.json({ signals });
  } catch (error) {
    console.error("GET /api/events/[id]/competitors error:", error);
    return NextResponse.json({ error: "Failed to fetch competitor signals" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const results = await extractCompetitors(params.id);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("POST /api/events/[id]/competitors error:", error);
    return NextResponse.json({ error: "Failed to extract competitor signals" }, { status: 500 });
  }
}
