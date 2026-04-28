import Anthropic from "@anthropic-ai/sdk";
import type { RecommendationType } from "./recommendation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessagingAngle {
  angle: string;
  detail: string;
}

export interface CfpAngle {
  title: string;
  abstract: string;
}

export interface StrategyBrief {
  recommendationType: RecommendationType;
  recommendationReason: string;
  messaging: MessagingAngle[];
  talkingPoints: string;
  staffing: string;
  sideEvents: string;
  partnerOpportunities: string;
  cfpAngles: CfpAngle[];
  cfpDraft: string;
}

export interface StrategyInput {
  recommendationType: RecommendationType;
  recommendationReason: string;
  // Event details
  eventName: string;
  eventType: string;
  city: string;
  country: string;
  region: string;
  attendanceEstimate: number | null;
  sponsorshipCost: number | null;
  cfpDeadline: Date | null;
  cfpInfoText: string;
  description: string;
  topicsJson: string[];
  // Scores
  totalScore: number;
  roiLabel: string;
  estimatedLeads: number | null;
  estimatedPipeline: number | null;
  // Company
  companyName: string;
  companyDescription: string;
  productsJson: Array<{ name: string; description: string }>;
  personasJson: Array<{ name: string; description: string }>;
  messagingJson: unknown[];
  positioningText: string;
  competitorsJson: string[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a field marketing strategist for a B2B infrastructure software company. Generate specific, actionable event strategy briefs. Ground all suggestions in the company profile and event context provided. Be specific — reference actual event audience, format, and size. Output only valid JSON.";

// ─── Fallback ─────────────────────────────────────────────────────────────────

function fallbackStrategy(input: StrategyInput): StrategyBrief {
  const { eventName, companyName, attendanceEstimate, city, country } = input;
  const audience = attendanceEstimate ? `${attendanceEstimate.toLocaleString()} attendees` : "attendees";

  return {
    recommendationType: input.recommendationType,
    recommendationReason: input.recommendationReason,
    messaging: [
      {
        angle: "Infrastructure reliability",
        detail: `Position ${companyName} as the backbone that lets ${eventName}'s ${audience} ship with confidence.`,
      },
      {
        angle: "Developer productivity",
        detail: `Highlight how ${companyName} cuts operational overhead so teams can focus on product.`,
      },
      {
        angle: "Open-source credibility",
        detail: `Lead with community trust and transparency — key differentiators for the ${eventName} audience.`,
      },
    ],
    talkingPoints: `- ${companyName} reduces infrastructure toil for engineering teams\n- Battle-tested by companies similar to ${eventName}'s attendee companies\n- Open-source core with enterprise support\n- Integrates with the tools developers already use`,
    staffing: `2 people recommended: 1 field marketer to run booth/logistics and 1 solutions engineer or AE to handle technical conversations. The AE should be familiar with the ${city}/${country} territory.`,
    sideEvents: `Host a private dinner for 10-15 VIP prospects on the evening before the main conference day. Consider a breakfast roundtable on infrastructure best practices. Scout for relevant meetups co-located with ${eventName}.`,
    partnerOpportunities: `Identify 2-3 complementary vendors attending ${eventName} (not direct competitors) for co-branded content or shared booth presence. Explore joint session proposals with ecosystem partners who also target the ${eventName} audience.`,
    cfpAngles: [
      {
        title: `How ${companyName} Scales Distributed Systems at ${eventName}-Scale`,
        abstract: `A technical deep-dive into the architectural decisions and operational patterns that allow modern infrastructure teams to handle growth without sacrificing reliability. We'll share real-world lessons, failure modes to avoid, and the tooling choices that made the difference.`,
      },
      {
        title: `The Hidden Cost of Infrastructure Complexity`,
        abstract: `Most engineering teams underestimate how much time and money is lost to infrastructure toil. This talk quantifies the cost and presents a practical framework for reducing complexity while maintaining control — with concrete examples from production environments.`,
      },
      {
        title: `Open Source in the Enterprise: Lessons Learned`,
        abstract: `What really happens when a company bets on open-source infrastructure in a regulated, high-scale enterprise environment? We share the honest account of what worked, what didn't, and how to make the case internally for open-source-first approaches.`,
      },
    ],
    cfpDraft: `Title: How ${companyName} Scales Distributed Systems at ${eventName}-Scale

Abstract:
Modern infrastructure teams face a paradox: the tools that give you control often add the complexity that slows you down. At ${companyName}, we've spent years working through this tension — building systems that are both powerful and operationally simple.

In this talk, we'll walk through the architectural decisions behind ${companyName}'s approach to distributed infrastructure, including: how we handle failure gracefully without over-engineering; the monitoring and observability patterns that give our team confidence; and the deployment strategies that let us ship frequently without incidents.

We'll share concrete numbers — latency improvements, on-call burden reductions, and team velocity gains — from teams that have adopted this approach. You'll leave with a practical checklist of infrastructure patterns to evaluate for your own environment, and a clearer picture of where the real complexity costs hide.

This talk is best suited for senior engineers, SREs, and engineering leaders managing distributed systems at scale.`,
  };
}

// ─── Claude strategy generation ───────────────────────────────────────────────

export async function generateStrategy(input: StrategyInput): Promise<StrategyBrief> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallbackStrategy(input);
  }

  const client = new Anthropic({ apiKey });

  const topics = input.topicsJson.join(", ") || "general technology";
  const personas = input.personasJson.map((p) => `${p.name}: ${p.description}`).join("; ") || "engineers and technical leaders";
  const products = input.productsJson.map((p) => `${p.name}: ${p.description}`).join("; ") || input.companyName;
  const competitors = input.competitorsJson.join(", ") || "none specified";

  const userPrompt = `Generate a complete event strategy brief for the following event and company. Return ONLY valid JSON — no markdown, no preamble.

## Company Profile
Name: ${input.companyName}
Description: ${input.companyDescription}
Products: ${products}
Target personas: ${personas}
Positioning: ${input.positioningText || "B2B infrastructure software"}
Competitors: ${competitors}

## Event
Name: ${input.eventName}
Type: ${input.eventType}
Location: ${input.city}, ${input.country} (${input.region})
Attendance estimate: ${input.attendanceEstimate ?? "unknown"}
Fit score: ${Math.round(input.totalScore)}/100
ROI label: ${input.roiLabel}
Estimated leads: ${input.estimatedLeads ?? "unknown"}
Estimated pipeline: ${input.estimatedPipeline ? `$${input.estimatedPipeline.toLocaleString()}` : "unknown"}
Sponsorship cost: ${input.sponsorshipCost !== null ? `$${input.sponsorshipCost.toLocaleString()}` : "unknown"}
Topics: ${topics}
CFP deadline: ${input.cfpDeadline ? input.cfpDeadline.toISOString().split("T")[0] : "unknown"}
CFP info: ${input.cfpInfoText}
Description: ${input.description.slice(0, 800)}

## Recommendation
Type: ${input.recommendationType}
Reason: ${input.recommendationReason}

Return this exact JSON structure:
{
  "messaging": [
    { "angle": "<angle title>", "detail": "<1-2 sentence detail>" },
    { "angle": "<angle title>", "detail": "<1-2 sentence detail>" },
    { "angle": "<angle title>", "detail": "<1-2 sentence detail>" }
  ],
  "talkingPoints": "<markdown bullet list of 4-6 talking points>",
  "staffing": "<1-2 sentences on headcount, roles, and responsibilities>",
  "sideEvents": "<2-3 sentences on dinner, roundtable, or meetup ideas>",
  "partnerOpportunities": "<2-3 sentences on co-marketing or joint presence ideas>",
  "cfpAngles": [
    { "title": "<talk title>", "abstract": "<2-3 sentence abstract>" },
    { "title": "<talk title>", "abstract": "<2-3 sentence abstract>" },
    { "title": "<talk title>", "abstract": "<2-3 sentence abstract>" }
  ],
  "cfpDraft": "<full CFP abstract ~250 words for the top angle, including title>"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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
    if (content.type !== "text") return fallbackStrategy(input);

    const raw = content.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(raw) as Omit<StrategyBrief, "recommendationType" | "recommendationReason">;

    return {
      recommendationType: input.recommendationType,
      recommendationReason: input.recommendationReason,
      messaging: parsed.messaging ?? [],
      talkingPoints: parsed.talkingPoints ?? "",
      staffing: parsed.staffing ?? "",
      sideEvents: parsed.sideEvents ?? "",
      partnerOpportunities: parsed.partnerOpportunities ?? "",
      cfpAngles: parsed.cfpAngles ?? [],
      cfpDraft: parsed.cfpDraft ?? "",
    };
  } catch (err) {
    console.error("Claude strategy generation failed:", err);
    return fallbackStrategy(input);
  }
}
