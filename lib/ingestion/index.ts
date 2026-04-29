// ─── Ingestion orchestrator ───────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { heuristicScoreOnly } from "@/lib/scoring";
import { computeROI } from "@/lib/roi";
import { runLumaIngestion, IngestionSourceResult } from "./luma";
import { runWebIngestion } from "./web";

export interface IngestionResult {
  lumaResult: IngestionSourceResult;
  webResult: IngestionSourceResult;
  totalCreated: number;
  totalUpdated: number;
  duration: number;
  newEventIds: string[];
}

export interface IngestionOptions {
  sources?: ("luma" | "web")[];
  keywords?: string[];
}

// ─── Extract keywords from company profile ────────────────────────────────────

interface NameDescription {
  name: string;
  description: string;
}

async function loadProfileKeywords(): Promise<string[]> {
  const profile = await prisma.companyProfile.findFirst();
  if (!profile) return [];

  const topics: string[] = [];

  if (Array.isArray(profile.productsJson)) {
    for (const p of profile.productsJson as unknown as NameDescription[]) {
      if (p.name) topics.push(p.name);
    }
  }

  if (Array.isArray(profile.personasJson)) {
    for (const p of profile.personasJson as unknown as NameDescription[]) {
      if (p.name) topics.push(p.name);
    }
  }

  return Array.from(new Set(topics));
}

// ─── Stub score for newly created events ─────────────────────────────────────

async function createStubScore(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const profile = await prisma.companyProfile.findFirst();
  if (!event || !profile) return;

  // Only create if score doesn't exist yet
  const existingScore = await prisma.eventScore.findUnique({ where: { eventId } });
  if (existingScore) return;

  const score = heuristicScoreOnly(event, profile);

  await prisma.eventScore.create({
    data: {
      eventId,
      audienceMatch: score.audienceMatch,
      topicRelevance: score.topicRelevance,
      strategicAlignment: score.strategicAlignment,
      budgetFit: score.budgetFit,
      competitorSignal: score.competitorSignal,
      sentiment: score.sentiment,
      totalScore: score.totalScore,
      confidence: score.confidence,
      scoreExplanationJson: score.explanations,
    },
  });
}

// ─── Compute ROI for newly created events ────────────────────────────────────

interface BudgetRanges {
  [tier: string]: { min: number; max: number };
}

type EventType = "conference" | "meetup" | "community" | "analyst";

async function createStubROI(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const profile = await prisma.companyProfile.findFirst();
  if (!event || !profile) return;

  const existingROI = await prisma.eventROI.findUnique({ where: { eventId } });
  if (existingROI) return;

  const roiResult = computeROI(
    {
      eventType: event.eventType,
      sponsorshipCost: event.sponsorshipCost,
      attendanceEstimate: event.attendanceEstimate,
    },
    {
      avgDealValue: profile.avgDealValue,
      leadToOppRate: profile.leadToOppRate,
      overheadPerEventJson: (profile.overheadPerEventJson as unknown as Record<EventType, number>) ?? {},
      leadEstimatesJson: (profile.leadEstimatesJson as unknown as Record<EventType, number>) ?? {},
      cplTargetsJson: (profile.cplTargetsJson as unknown as Record<string, number>) ?? {},
    }
  );

  await prisma.eventROI.create({
    data: {
      eventId,
      estimatedCost: roiResult.estimatedCost,
      estimatedLeads: roiResult.estimatedLeads,
      cplLow: roiResult.cplLow,
      cplHigh: roiResult.cplHigh,
      estimatedPipeline: roiResult.estimatedPipeline,
      roiMultiplier: roiResult.roiMultiplier,
      roiLabel: roiResult.roiLabel,
      calculationInputsJson: roiResult.calculationInputs as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}

// ─── Create planning status for newly created events ─────────────────────────

async function createPlanningStatus(eventId: string): Promise<void> {
  const existing = await prisma.planningStatus.findUnique({ where: { eventId } });
  if (existing) return;

  await prisma.planningStatus.create({
    data: {
      eventId,
      status: "candidate",
    },
  });
}

// ─── Mark stale scores ────────────────────────────────────────────────────────

async function markStaleScores(): Promise<void> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.eventScore.updateMany({
    where: {
      updatedAt: { lt: staleThreshold },
      confidence: { not: "low" },
    },
    data: { confidence: "low" },
  });
}

// ─── Newly created event IDs ─────────────────────────────────────────────────

async function getNewEventIds(beforeTime: Date): Promise<string[]> {
  const newEvents = await prisma.event.findMany({
    where: { createdAt: { gte: beforeTime } },
    select: { id: true },
  });
  return newEvents.map((e) => e.id);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runIngestion(options: IngestionOptions = {}): Promise<IngestionResult> {
  const start = Date.now();
  const sources = options.sources ?? ["luma", "web"];
  const beforeTime = new Date();

  // Load keywords from profile or use provided ones
  const profileKeywords = await loadProfileKeywords();
  const keywords = options.keywords && options.keywords.length > 0
    ? options.keywords
    : profileKeywords;

  const emptyResult: IngestionSourceResult = { created: 0, updated: 0, errors: [] };
  let lumaResult = { ...emptyResult };
  let webResult = { ...emptyResult };

  // Run selected sources (independently — errors in one don't stop the other)
  if (sources.includes("luma")) {
    try {
      lumaResult = await runLumaIngestion(keywords, prisma);
    } catch (err) {
      lumaResult.errors.push(
        `Luma ingestion crashed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (sources.includes("web")) {
    try {
      webResult = await runWebIngestion(prisma);
    } catch (err) {
      webResult.errors.push(
        `Web ingestion crashed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Collect newly created event IDs
  const newEventIds = await getNewEventIds(beforeTime);

  // For each new event: create stub score, ROI, planning status
  for (const eventId of newEventIds) {
    try {
      await createStubScore(eventId);
    } catch {
      // non-fatal
    }
    try {
      await createStubROI(eventId);
    } catch {
      // non-fatal
    }
    try {
      await createPlanningStatus(eventId);
    } catch {
      // non-fatal
    }
  }

  // Mark old scores as stale
  try {
    await markStaleScores();
  } catch {
    // non-fatal
  }

  const duration = Date.now() - start;

  return {
    lumaResult,
    webResult,
    totalCreated: lumaResult.created + webResult.created,
    totalUpdated: lumaResult.updated + webResult.updated,
    duration,
    newEventIds,
  };
}
