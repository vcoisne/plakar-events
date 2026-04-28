import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationType = "Sponsor" | "Speak" | "Attend" | "Pass";

export interface RecommendationInput {
  totalScore: number;
  roiLabel: string;
  sponsorshipCost: number | null;
  cfpDeadline: Date | null;
  cfpInfoText: string;
  eventName: string;
  eventType: string;
  city: string;
  country: string;
  attendanceEstimate: number | null;
  description: string;
  companyName: string;
  companyDescription: string;
}

export interface RecommendationResult {
  type: RecommendationType;
  reason: string;
}

// ─── Deterministic logic ──────────────────────────────────────────────────────

function cfpIsOpen(cfpDeadline: Date | null, cfpInfoText: string): boolean {
  if (cfpDeadline !== null) {
    return cfpDeadline.getTime() > Date.now();
  }
  const text = cfpInfoText.toLowerCase();
  return (
    text.includes("cfp open") ||
    text.includes("call for proposals") ||
    text.includes("call for papers") ||
    text.includes("submit your talk") ||
    text.includes("submit a talk")
  );
}

export function determineRecommendationType(input: RecommendationInput): RecommendationType {
  const { totalScore, roiLabel, sponsorshipCost, cfpDeadline, cfpInfoText } = input;

  if (
    totalScore >= 75 &&
    (roiLabel === "Strong" || roiLabel === "Moderate") &&
    sponsorshipCost !== null
  ) {
    return "Sponsor";
  }

  if (totalScore >= 65 && cfpIsOpen(cfpDeadline, cfpInfoText)) {
    return "Speak";
  }

  if (totalScore >= 50) {
    return "Attend";
  }

  return "Pass";
}

// ─── Fallback reason ──────────────────────────────────────────────────────────

function fallbackReason(type: RecommendationType, input: RecommendationInput): string {
  const score = Math.round(input.totalScore);
  const location = `${input.city}, ${input.country}`;

  switch (type) {
    case "Sponsor":
      return `${input.eventName} scored ${score}/100 — a strong fit for ${input.companyName}. With ${input.attendanceEstimate ? input.attendanceEstimate.toLocaleString() + " attendees" : "a sizeable audience"} in ${location} and a favorable ROI profile (${input.roiLabel}), sponsorship is well-justified. The event's focus aligns with your target audience and budget parameters.`;
    case "Speak":
      return `${input.eventName} scored ${score}/100 and has an open CFP — a good speaking opportunity for ${input.companyName}. With ${input.attendanceEstimate ? input.attendanceEstimate.toLocaleString() + " expected attendees" : "a relevant audience"} in ${location}, a talk here can build brand awareness and generate quality leads with minimal spend.`;
    case "Attend":
      return `${input.eventName} scored ${score}/100, making it worth attending for ${input.companyName}. The event in ${location} offers networking and competitive intelligence opportunities. Send 1-2 people to represent the brand and scan the landscape.`;
    case "Pass":
      return `${input.eventName} scored ${score}/100 — below the threshold to justify investment for ${input.companyName}. The event's audience, topics, or cost structure don't sufficiently align with current priorities. Revisit if the profile changes.`;
  }
}

// ─── Claude reason generation ─────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a field marketing strategist for a B2B infrastructure software company. Generate concise, specific event recommendations grounded in the event data and company profile provided. Output only the recommendation reason text — no JSON, no markdown, no labels. Write 2-4 sentences.";

async function claudeReason(
  type: RecommendationType,
  input: RecommendationInput
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const userPrompt = `Generate a 2-4 sentence recommendation reason for the following event.

Recommendation: ${type}

Company: ${input.companyName}
Company description: ${input.companyDescription}

Event: ${input.eventName}
Type: ${input.eventType}
Location: ${input.city}, ${input.country}
Attendance estimate: ${input.attendanceEstimate ?? "unknown"}
Fit score: ${Math.round(input.totalScore)}/100
ROI label: ${input.roiLabel}
Sponsorship cost: ${input.sponsorshipCost !== null ? `$${input.sponsorshipCost.toLocaleString()}` : "unknown"}
CFP deadline: ${input.cfpDeadline ? input.cfpDeadline.toISOString().split("T")[0] : "unknown"}
Description: ${input.description.slice(0, 500)}

Write the reason grounded in the specific event and company context. Be concrete and actionable. No markdown.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cache_control: { type: "ephemeral" } as any,
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;
    return content.text.trim();
  } catch (err) {
    console.error("Claude recommendation reason failed:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateRecommendation(
  input: RecommendationInput
): Promise<RecommendationResult> {
  const type = determineRecommendationType(input);
  const reason = (await claudeReason(type, input)) ?? fallbackReason(type, input);
  return { type, reason };
}
