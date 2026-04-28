import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, owner, notes } = body as {
      status?: string;
      owner?: string;
      notes?: string;
    };

    const planningStatus = await prisma.planningStatus.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        status: status ?? "candidate",
        owner: owner ?? "",
        notes: notes ?? "",
      },
      update: {
        ...(status !== undefined && { status }),
        ...(owner !== undefined && { owner }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(planningStatus);
  } catch (error) {
    console.error(`POST /api/events/${params.id}/status error:`, error);
    return NextResponse.json(
      { error: "Failed to update planning status" },
      { status: 500 }
    );
  }
}
