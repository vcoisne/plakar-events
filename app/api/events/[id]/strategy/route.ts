import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateRecommendation, type RecommendationInput } from "@/lib/recommendation";
import { generateStrategy, type StrategyInput } from "@/lib/strategy";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const strategy = await prisma.eventStrategy.findUnique({
      where: { eventId: params.id },
    });

    if (!strategy) {
      return NextResponse.json(null);
    }

    return NextResponse.json(strategy);
  } catch (error) {
    console.error(`GET /api/events/${params.id}/strategy error:`, error);
    return NextResponse.json({ error: "Failed to fetch strategy" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Fetch all needed data in parallel
    const [event, profile] = await Promise.all([
      prisma.event.findUnique({
        where: { id },
        include: { score: true, roi: true },
      }),
      prisma.companyProfile.findFirst(),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (!profile) {
      return NextResponse.json({ error: "No company profile configured" }, { status: 400 });
    }

    const totalScore = event.score?.totalScore ?? 0;
    const roiLabel = event.roi?.roiLabel ?? "Unknown";

    // Build recommendation input
    const recInput: RecommendationInput = {
      totalScore,
      roiLabel,
      sponsorshipCost: event.sponsorshipCost,
      cfpDeadline: event.cfpDeadline,
      cfpInfoText: event.cfpInfoText,
      eventName: event.name,
      eventType: event.eventType,
      city: event.city,
      country: event.country,
      attendanceEstimate: event.attendanceEstimate,
      description: event.description,
      companyName: profile.companyName,
      companyDescription: profile.description,
    };

    // Get recommendation
    const { type: recommendationType, reason: recommendationReason } =
      await generateRecommendation(recInput);

    // Build strategy input
    const stratInput: StrategyInput = {
      recommendationType,
      recommendationReason,
      eventName: event.name,
      eventType: event.eventType,
      city: event.city,
      country: event.country,
      region: event.region,
      attendanceEstimate: event.attendanceEstimate,
      sponsorshipCost: event.sponsorshipCost,
      cfpDeadline: event.cfpDeadline,
      cfpInfoText: event.cfpInfoText,
      description: event.description,
      topicsJson: Array.isArray(event.topicsJson) ? (event.topicsJson as string[]) : [],
      totalScore,
      roiLabel,
      estimatedLeads: event.roi?.estimatedLeads ?? null,
      estimatedPipeline: event.roi?.estimatedPipeline ?? null,
      companyName: profile.companyName,
      companyDescription: profile.description,
      productsJson: Array.isArray(profile.productsJson)
        ? (profile.productsJson as Array<{ name: string; description: string }>)
        : [],
      personasJson: Array.isArray(profile.personasJson)
        ? (profile.personasJson as Array<{ name: string; description: string }>)
        : [],
      messagingJson: Array.isArray(profile.messagingJson) ? (profile.messagingJson as unknown[]) : [],
      positioningText: profile.positioningText,
      competitorsJson: Array.isArray(profile.competitorsJson)
        ? (profile.competitorsJson as string[])
        : [],
    };

    // Generate full strategy
    const brief = await generateStrategy(stratInput);

    const messagingJson = brief.messaging as unknown as Prisma.InputJsonValue;
    const cfpAnglesJson = brief.cfpAngles as unknown as Prisma.InputJsonValue;

    // Upsert EventStrategy
    const strategy = await prisma.eventStrategy.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        recommendationType: brief.recommendationType,
        recommendationReason: brief.recommendationReason,
        messagingJson,
        talkingPointsText: brief.talkingPoints,
        staffingText: brief.staffing,
        sideEventsText: brief.sideEvents,
        partnerOpportunitiesText: brief.partnerOpportunities,
        cfpAnglesJson,
        cfpDraftText: brief.cfpDraft,
        generatedAt: new Date(),
      },
      update: {
        recommendationType: brief.recommendationType,
        recommendationReason: brief.recommendationReason,
        messagingJson,
        talkingPointsText: brief.talkingPoints,
        staffingText: brief.staffing,
        sideEventsText: brief.sideEvents,
        partnerOpportunitiesText: brief.partnerOpportunities,
        cfpAnglesJson,
        cfpDraftText: brief.cfpDraft,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json(strategy);
  } catch (error) {
    console.error(`POST /api/events/${params.id}/strategy error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strategy generation failed" },
      { status: 500 }
    );
  }
}
