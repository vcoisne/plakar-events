import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorResult {
  name: string;
  found: boolean;
  tier: string;
  evidenceSnippet: string;
  confidence: "high" | "medium" | "low";
}

interface ClaudeCompetitorResponse {
  competitors: Array<{
    name: string;
    found: boolean;
    tier: string;
    evidenceSnippet: string;
    confidence: "high" | "medium" | "low";
  }>;
}

// ─── HTML stripping ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Fetch event page text ────────────────────────────────────────────────────

async function fetchEventText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlakarEventsBot/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const text = stripHtml(html);
    return text.slice(0, 8000);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ─── Fallback (all unknown) ───────────────────────────────────────────────────

function buildFallbackResults(competitors: string[]): CompetitorResult[] {
  return competitors.map((name) => ({
    name,
    found: false,
    tier: "unknown",
    evidenceSnippet: "",
    confidence: "low",
  }));
}

// ─── Claude extraction ────────────────────────────────────────────────────────

async function claudeExtract(
  pageText: string,
  competitors: string[],
  eventName: string
): Promise<CompetitorResult[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const systemPrompt =
    "You are a competitive intelligence analyst. Given the text of an event website, identify whether specific competitors are sponsoring or attending. Return only valid JSON.";

  const userPrompt = `Analyze the following event page text and determine whether each competitor is present as a sponsor or exhibitor.

Event: ${eventName}
Competitors to check: ${competitors.join(", ")}

Event page text (truncated):
${pageText}

For each competitor, determine:
- found: true if they appear as a sponsor, exhibitor, or partner; false otherwise
- tier: their sponsorship tier if mentioned (e.g. "Gold", "Platinum", "Silver", "Bronze", "Partner") or "unknown"
- evidenceSnippet: a short verbatim quote from the page that supports your finding, or empty string if not found
- confidence: "high" if clearly mentioned, "medium" if implied, "low" if uncertain

Return ONLY valid JSON, no markdown:
{
  "competitors": [
    { "name": "<competitor name>", "found": <true|false>, "tier": "<tier or unknown>", "evidenceSnippet": "<quote or empty>", "confidence": "<high|medium|low>" }
  ]
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

    const raw = content.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as ClaudeCompetitorResponse;

    if (!Array.isArray(parsed.competitors)) return null;

    return parsed.competitors.map((c) => ({
      name: c.name,
      found: Boolean(c.found),
      tier: c.tier ?? "unknown",
      evidenceSnippet: c.evidenceSnippet ?? "",
      confidence: (["high", "medium", "low"].includes(c.confidence) ? c.confidence : "low") as
        | "high"
        | "medium"
        | "low",
    }));
  } catch (err) {
    console.error("Claude competitor extraction failed:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractCompetitors(eventId: string): Promise<CompetitorResult[]> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error(`Event ${eventId} not found`);

  const profile = await prisma.companyProfile.findFirst();
  const competitors: string[] = Array.isArray(profile?.competitorsJson)
    ? (profile.competitorsJson as unknown as string[])
    : [];

  if (competitors.length === 0) {
    return [];
  }

  // Fetch and strip page text
  const pageText = await fetchEventText(event.url);

  // Extract via Claude or fall back
  let results: CompetitorResult[];
  if (pageText) {
    results = (await claudeExtract(pageText, competitors, event.name)) ?? buildFallbackResults(competitors);
  } else {
    results = buildFallbackResults(competitors);
  }

  // Delete existing signals for this event, then re-create from fresh results
  const now = new Date();
  await prisma.competitorSignal.deleteMany({ where: { eventId } });
  await prisma.competitorSignal.createMany({
    data: results.map((r) => ({
      eventId,
      competitorName: r.name,
      sponsorStatus: r.found ? "yes" : "no",
      sponsorTier: r.tier,
      evidenceText: r.evidenceSnippet,
      confidence: r.confidence,
      updatedAt: now,
    })),
  });

  return results;
}
