import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

interface OverrideBody {
  recommendationType: string;
  recommendationReason: string;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = (await request.json()) as OverrideBody;
    const { recommendationType, recommendationReason } = body;

    if (!recommendationType || !recommendationReason) {
      return NextResponse.json(
        { error: "recommendationType and recommendationReason are required" },
        { status: 400 }
      );
    }

    const validTypes = ["Sponsor", "Speak", "Attend", "Pass"];
    if (!validTypes.includes(recommendationType)) {
      return NextResponse.json(
        { error: `recommendationType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Ensure strategy record exists
    const existing = await prisma.eventStrategy.findUnique({
      where: { eventId: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No strategy found for this event. Generate a strategy first." },
        { status: 404 }
      );
    }

    const updated = await prisma.eventStrategy.update({
      where: { eventId: params.id },
      data: {
        recommendationType,
        recommendationReason,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`PUT /api/events/${params.id}/strategy-override error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Override failed" },
      { status: 500 }
    );
  }
}
