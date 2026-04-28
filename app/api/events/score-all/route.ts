import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(_request: NextRequest) {
  try {
    const events = await prisma.event.findMany({ select: { id: true, name: true } });

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const event of events) {
      try {
        const scoreData = await computeScore(event.id);

        await prisma.eventScore.upsert({
          where: { eventId: event.id },
          create: {
            eventId: event.id,
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

        results.push({ id: event.id, name: event.name, success: true });
      } catch (err) {
        results.push({
          id: event.id,
          name: event.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // 200ms delay between calls to avoid rate limiting
      await delay(200);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: events.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error("POST /api/events/score-all error:", error);
    return NextResponse.json({ error: "Score-all failed" }, { status: 500 });
  }
}
