import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NameDescription {
  name: string;
  description: string;
}

interface BudgetRanges {
  [tier: string]: { min: number; max: number };
}

interface CompanyProfileData {
  personasJson: NameDescription[];
  productsJson: NameDescription[];
  regionsJson: string[];
  competitorsJson: string[];
  budgetRangesJson: BudgetRanges;
  avgDealValue: number;
  leadToOppRate: number;
}

interface EventData {
  id: string;
  name: string;
  eventType: string;
  topicsJson: unknown;
  description: string;
  city: string;
  country: string;
  region: string;
  attendanceEstimate: number | null;
  sponsorshipCost: number | null;
  cfpDeadline: Date | null;
}

interface ScoreExplanations {
  audienceMatch: string;
  topicRelevance: string;
  strategicAlignment: string;
  budgetFit: string;
  competitorSignal: string;
  sentiment: string;
  [key: string]: string;
}

interface ClaudeScoreResponse {
  audienceMatch: number;
  topicRelevance: number;
  strategicAlignment: number;
  budgetFit: number;
  competitorSignal: number;
  sentiment: number;
  explanations: ScoreExplanations;
}

interface EventScore {
  audienceMatch: number;
  topicRelevance: number;
  strategicAlignment: number;
  budgetFit: number;
  competitorSignal: number;
  sentiment: number;
  totalScore: number;
  confidence: "high" | "medium" | "low";
  explanations: ScoreExplanations;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function computeConfidence(event: EventData): "high" | "medium" | "low" {
  const known = [
    event.sponsorshipCost !== null,
    event.attendanceEstimate !== null,
    event.cfpDeadline !== null,
  ].filter(Boolean).length;

  if (known === 3) return "high";
  if (known >= 1) return "medium";
  return "low";
}

function computeTotalScore(scores: Omit<EventScore, "totalScore" | "confidence" | "explanations">): number {
  return clamp(
    scores.audienceMatch * 0.25 +
    scores.topicRelevance * 0.25 +
    scores.strategicAlignment * 0.20 +
    scores.budgetFit * 0.15 +
    scores.competitorSignal * 0.10 +
    scores.sentiment * 0.05
  );
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────

function heuristicScore(event: EventData, profile: CompanyProfileData): EventScore {
  const topics = (Array.isArray(event.topicsJson) ? event.topicsJson as string[] : []).map((t) =>
    String(t).toLowerCase()
  );
  const description = event.description.toLowerCase();

  // topicRelevance: keyword overlap between event topics/description and product descriptions
  const productKeywords = profile.productsJson
    .flatMap((p) => `${p.name} ${p.description}`.toLowerCase().split(/\s+/))
    .filter((w) => w.length > 3);
  const topicHits = productKeywords.filter(
    (kw) => topics.some((t) => t.includes(kw)) || description.includes(kw)
  ).length;
  const topicRelevance = clamp(Math.min(100, topicHits * 10));

  // audienceMatch: persona keyword matches
  const personaKeywords = profile.personasJson
    .flatMap((p) => `${p.name} ${p.description}`.toLowerCase().split(/\s+/))
    .filter((w) => w.length > 3);
  const personaHits = personaKeywords.filter((kw) => description.includes(kw)).length;
  const audienceMatch = clamp(Math.min(100, personaHits * 12));

  // strategicAlignment: region match
  const regions = profile.regionsJson.map((r) => r.toLowerCase());
  const eventRegion = event.region.toLowerCase();
  const strategicAlignment = regions.some((r) => eventRegion.includes(r) || r.includes(eventRegion))
    ? 100
    : 50;

  // budgetFit: sponsorshipCost vs budget ranges
  let budgetFit = 70; // neutral default
  if (event.sponsorshipCost !== null) {
    const ranges = Object.values(profile.budgetRangesJson);
    const inRange = ranges.some(
      (r) => event.sponsorshipCost! >= r.min && event.sponsorshipCost! <= r.max
    );
    if (inRange) {
      budgetFit = 100;
    } else {
      const maxBudget = Math.max(...ranges.map((r) => r.max));
      if (maxBudget > 0) {
        const ratio = event.sponsorshipCost / maxBudget;
        budgetFit = clamp(100 / ratio);
      }
    }
  }

  // competitorSignal: neutral fallback
  const competitorSignal = 50;

  // sentiment: scaled from attendanceEstimate (log scale)
  let sentiment = 30;
  if (event.attendanceEstimate !== null && event.attendanceEstimate > 0) {
    const log = Math.log10(event.attendanceEstimate);
    // log10(100)=2 → 30, log10(1000)=3 → 50, log10(50000)≈4.7 → 100
    sentiment = clamp(Math.round((log / Math.log10(50000)) * 100));
  }

  const scores = { audienceMatch, topicRelevance, strategicAlignment, budgetFit, competitorSignal, sentiment };

  return {
    ...scores,
    totalScore: computeTotalScore(scores),
    confidence: computeConfidence(event),
    explanations: {
      audienceMatch: `Matched ${personaHits} persona keywords in event description (heuristic).`,
      topicRelevance: `Found ${topicHits} product keyword overlaps across event topics (heuristic).`,
      strategicAlignment: strategicAlignment === 100 ? "Event region matches a configured target region." : "Event region does not exactly match configured regions.",
      budgetFit: event.sponsorshipCost !== null ? `Sponsorship cost $${event.sponsorshipCost} scored against budget ranges.` : "No sponsorship cost available; using neutral score.",
      competitorSignal: "No competitor data available; using neutral score.",
      sentiment: event.attendanceEstimate !== null ? `Estimated ${event.attendanceEstimate} attendees; scored on log scale.` : "No attendance data; using minimal score.",
    },
  };
}

// ─── Claude API scoring ───────────────────────────────────────────────────────

async function claudeScore(event: EventData, profile: CompanyProfileData): Promise<EventScore | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const systemPrompt =
    "You are an event scoring engine for a B2B SaaS company. Score how well each conference or meetup matches the company's target audience, topics, regions, and budget. Return only valid JSON.";

  const topics = Array.isArray(event.topicsJson) ? event.topicsJson : [];

  const userPrompt = `Score this event for the company profile below. Return ONLY a JSON object with no markdown.

## Company Profile
- Personas: ${profile.personasJson.map((p) => `${p.name}: ${p.description}`).join("; ")}
- Products: ${profile.productsJson.map((p) => `${p.name}: ${p.description}`).join("; ")}
- Target regions: ${profile.regionsJson.join(", ")}
- Competitors: ${profile.competitorsJson.join(", ")}
- Budget ranges: ${JSON.stringify(profile.budgetRangesJson)}

## Event
- Name: ${event.name}
- Type: ${event.eventType}
- Topics: ${(topics as string[]).join(", ")}
- Description: ${event.description.slice(0, 1000)}
- Location: ${event.city}, ${event.country} (${event.region})
- Attendance estimate: ${event.attendanceEstimate ?? "unknown"}
- Sponsorship cost: ${event.sponsorshipCost !== null ? `$${event.sponsorshipCost}` : "unknown"}

Return JSON exactly:
{
  "audienceMatch": <0-100>,
  "topicRelevance": <0-100>,
  "strategicAlignment": <0-100>,
  "budgetFit": <0-100>,
  "competitorSignal": <0-100>,
  "sentiment": <0-100>,
  "explanations": {
    "audienceMatch": "<1 sentence>",
    "topicRelevance": "<1 sentence>",
    "strategicAlignment": "<1 sentence>",
    "budgetFit": "<1 sentence>",
    "competitorSignal": "<1 sentence>",
    "sentiment": "<1 sentence>"
  }
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: systemPrompt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cache_control: { type: "ephemeral" } as any,
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    // Strip potential markdown fences
    const raw = content.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as ClaudeScoreResponse;

    const scores = {
      audienceMatch: clamp(parsed.audienceMatch),
      topicRelevance: clamp(parsed.topicRelevance),
      strategicAlignment: clamp(parsed.strategicAlignment),
      budgetFit: clamp(parsed.budgetFit),
      competitorSignal: clamp(parsed.competitorSignal),
      sentiment: clamp(parsed.sentiment),
    };

    return {
      ...scores,
      totalScore: computeTotalScore(scores),
      confidence: computeConfidence(event),
      explanations: parsed.explanations,
    };
  } catch (err) {
    console.error("Claude scoring failed:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeScore(eventId: string): Promise<{
  audienceMatch: number;
  topicRelevance: number;
  strategicAlignment: number;
  budgetFit: number;
  competitorSignal: number;
  sentiment: number;
  totalScore: number;
  confidence: string;
  scoreExplanationJson: Record<string, string>;
}> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error(`Event ${eventId} not found`);

  const profile = await prisma.companyProfile.findFirst();
  if (!profile) throw new Error("No company profile configured");

  const profileData: CompanyProfileData = {
    personasJson: Array.isArray(profile.personasJson) ? (profile.personasJson as unknown as NameDescription[]) : [],
    productsJson: Array.isArray(profile.productsJson) ? (profile.productsJson as unknown as NameDescription[]) : [],
    regionsJson: Array.isArray(profile.regionsJson) ? (profile.regionsJson as unknown as string[]) : [],
    competitorsJson: Array.isArray(profile.competitorsJson) ? (profile.competitorsJson as unknown as string[]) : [],
    budgetRangesJson: (profile.budgetRangesJson as unknown as BudgetRanges) ?? {},
    avgDealValue: profile.avgDealValue,
    leadToOppRate: profile.leadToOppRate,
  };

  const eventData: EventData = {
    id: event.id,
    name: event.name,
    eventType: event.eventType,
    topicsJson: event.topicsJson,
    description: event.description,
    city: event.city,
    country: event.country,
    region: event.region,
    attendanceEstimate: event.attendanceEstimate,
    sponsorshipCost: event.sponsorshipCost,
    cfpDeadline: event.cfpDeadline,
  };

  // Try Claude first, fall back to heuristic
  const result = (await claudeScore(eventData, profileData)) ?? heuristicScore(eventData, profileData);

  return {
    audienceMatch: result.audienceMatch,
    topicRelevance: result.topicRelevance,
    strategicAlignment: result.strategicAlignment,
    budgetFit: result.budgetFit,
    competitorSignal: result.competitorSignal,
    sentiment: result.sentiment,
    totalScore: result.totalScore,
    confidence: result.confidence,
    scoreExplanationJson: result.explanations,
  };
}
