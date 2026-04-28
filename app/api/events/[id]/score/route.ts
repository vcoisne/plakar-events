import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Compute score
    const scoreData = await computeScore(id);

    // Upsert EventScore
    const score = await prisma.eventScore.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        audienceMatch: scoreData.audienceMatch,
        topicRelevance: scoreData.topicRelevance,
        strategicAlignment: scoreData.strategicAlignment,
        budgetFit: scoreData.budgetFit,
        competitorSignal: scoreData.competitorSignal,
        sentiment: scoreData.sentiment,
        totalScore: scoreData.totalScore,
        confidence: scoreData.confidence,
        scoreExplanationJson: scoreData.scoreExplanationJson,
      },
      update: {
        audienceMatch: scoreData.audienceMatch,
        topicRelevance: scoreData.topicRelevance,
        strategicAlignment: scoreData.strategicAlignment,
        budgetFit: scoreData.budgetFit,
        competitorSignal: scoreData.competitorSignal,
        sentiment: scoreData.sentiment,
        totalScore: scoreData.totalScore,
        confidence: scoreData.confidence,
        scoreExplanationJson: scoreData.scoreExplanationJson,
      },
    });

    return NextResponse.json(score);
  } catch (error) {
    console.error(`POST /api/events/${params.id}/score error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scoring failed" },
      { status: 500 }
    );
  }
}
