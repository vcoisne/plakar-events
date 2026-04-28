import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { computeROI, ROIUserOverrides, CompanyProfileForROI, EventType } from "@/lib/roi";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id },
      include: { roi: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Parse body for user overrides
    let bodyOverrides: ROIUserOverrides = {};
    try {
      const body = await request.json();
      bodyOverrides = body ?? {};
    } catch {
      // empty body is fine
    }

    // Merge with existing user overrides stored in DB
    const existingOverrides = (event.roi?.userOverridesJson as ROIUserOverrides) ?? {};
    const mergedOverrides: ROIUserOverrides = { ...existingOverrides, ...bodyOverrides };

    // Get company profile
    const profile = await prisma.companyProfile.findFirst();
    if (!profile) {
      return NextResponse.json({ error: "No company profile configured" }, { status: 400 });
    }

    const profileForROI: CompanyProfileForROI = {
      avgDealValue: profile.avgDealValue,
      leadToOppRate: profile.leadToOppRate,
      overheadPerEventJson: (profile.overheadPerEventJson as Record<EventType, number>) ?? {},
      leadEstimatesJson: (profile.leadEstimatesJson as Record<EventType, number>) ?? {},
      cplTargetsJson: (profile.cplTargetsJson as Record<string, number>) ?? {},
    };

    // Compute ROI
    const roiData = computeROI(
      {
        eventType: event.eventType,
        sponsorshipCost: event.sponsorshipCost,
        attendanceEstimate: event.attendanceEstimate,
      },
      profileForROI,
      mergedOverrides
    );

    // Upsert EventROI
    const roi = await prisma.eventROI.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        estimatedCost: roiData.estimatedCost,
        estimatedLeads: roiData.estimatedLeads,
        cplLow: roiData.cplLow,
        cplHigh: roiData.cplHigh,
        estimatedPipeline: roiData.estimatedPipeline,
        roiMultiplier: roiData.roiMultiplier,
        roiLabel: roiData.roiLabel,
        calculationInputsJson: JSON.parse(JSON.stringify(roiData.calculationInputs)) as Prisma.InputJsonValue,
        userOverridesJson: JSON.parse(JSON.stringify(mergedOverrides)) as Prisma.InputJsonValue,
      },
      update: {
        estimatedCost: roiData.estimatedCost,
        estimatedLeads: roiData.estimatedLeads,
        cplLow: roiData.cplLow,
        cplHigh: roiData.cplHigh,
        estimatedPipeline: roiData.estimatedPipeline,
        roiMultiplier: roiData.roiMultiplier,
        roiLabel: roiData.roiLabel,
        calculationInputsJson: JSON.parse(JSON.stringify(roiData.calculationInputs)) as Prisma.InputJsonValue,
        userOverridesJson: JSON.parse(JSON.stringify(mergedOverrides)) as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ...roi, calculationInputs: roiData.calculationInputs });
  } catch (error) {
    console.error(`PUT /api/events/${params.id}/roi error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ROI computation failed" },
      { status: 500 }
    );
  }
}
