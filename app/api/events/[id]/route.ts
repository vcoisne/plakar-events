import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        score: true,
        roi: true,
        competitorSignals: true,
        strategy: true,
        planningStatus: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error(`GET /api/events/${params.id} error:`, error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}
