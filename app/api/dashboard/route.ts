import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    const [topScoredRaw, openCfpRaw, pendingDecisionsRaw, budgetSummaryRaw] = await Promise.all([
      // Top 5 events by totalScore
      prisma.eventScore.findMany({
        orderBy: { totalScore: "desc" },
        take: 5,
        include: {
          event: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
              startDate: true,
              eventType: true,
            },
          },
        },
      }),

      // Events with open CFPs (deadline in the future)
      prisma.event.findMany({
        where: {
          cfpDeadline: { gt: now },
        },
        orderBy: { cfpDeadline: "asc" },
        select: {
          id: true,
          name: true,
          cfpDeadline: true,
          city: true,
          country: true,
        },
      }),

      // Events with planning status 'candidate' and totalScore >= 60
      prisma.planningStatus.findMany({
        where: { status: "candidate" },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
              startDate: true,
              score: { select: { totalScore: true } },
            },
          },
        },
      }),

      // Sum of estimatedCost for approved events
      prisma.eventROI.aggregate({
        _sum: { estimatedCost: true },
        where: {
          event: {
            planningStatus: { status: "approved" },
          },
        },
      }),
    ]);

    // Filter pending decisions to only those with score >= 60
    const pendingDecisions = pendingDecisionsRaw
      .filter((ps) => (ps.event.score?.totalScore ?? 0) >= 60)
      .map((ps) => ({
        id: ps.event.id,
        name: ps.event.name,
        city: ps.event.city,
        country: ps.event.country,
        startDate: ps.event.startDate,
        totalScore: ps.event.score?.totalScore ?? 0,
      }));

    const topScoredEvents = topScoredRaw.map((es) => ({
      id: es.event.id,
      name: es.event.name,
      city: es.event.city,
      country: es.event.country,
      startDate: es.event.startDate,
      eventType: es.event.eventType,
      totalScore: es.totalScore,
    }));

    const openCfpEvents = openCfpRaw.map((e) => ({
      id: e.id,
      name: e.name,
      cfpDeadline: e.cfpDeadline,
      city: e.city,
      country: e.country,
      daysUntil: e.cfpDeadline
        ? Math.ceil((e.cfpDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return NextResponse.json({
      topScoredEvents,
      openCfpEvents,
      pendingDecisions,
      budgetSummary: {
        totalApprovedCost: budgetSummaryRaw._sum.estimatedCost ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
