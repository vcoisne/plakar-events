import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: {
        planningStatus: { isNot: null },
      },
      orderBy: { startDate: "asc" },
      include: {
        score: true,
        roi: true,
        planningStatus: true,
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/planning error:", error);
    return NextResponse.json({ error: "Failed to fetch planning events" }, { status: 500 });
  }
}
