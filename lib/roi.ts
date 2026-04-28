// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType = "conference" | "meetup" | "community" | "analyst";

export interface CompanyProfileForROI {
  avgDealValue: number;
  leadToOppRate: number; // percentage, e.g. 20 means 20%
  overheadPerEventJson: Record<EventType, number>;
  leadEstimatesJson: Record<EventType, number>;
  cplTargetsJson: Record<string, number>;
}

export interface ROIUserOverrides {
  estimatedCost?: number;
  estimatedLeads?: number;
  avgDealValue?: number;
  leadToOppRate?: number;
}

export interface ROIInputRow {
  label: string;
  value: string;
  source: "event listing" | "company default" | "user override" | "computed";
}

export interface ROIResult {
  estimatedCost: number | null;
  estimatedLeads: number | null;
  cplLow: number | null;
  cplHigh: number | null;
  estimatedPipeline: number | null;
  totalCost: number | null;
  roiMultiplier: number | null;
  roiLabel: "Strong" | "Moderate" | "Weak" | "Unknown";
  calculationInputs: ROIInputRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONVERSION_RATE: Record<EventType, number> = {
  conference: 0.02,
  meetup: 0.05,
  community: 0.03,
  analyst: 0.01,
};

function normalizeEventType(raw: string): EventType {
  const t = raw.toLowerCase();
  if (t === "meetup") return "meetup";
  if (t === "community") return "community";
  if (t === "analyst") return "analyst";
  return "conference";
}

function formatMoney(v: number | null): string {
  if (v === null) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// ─── ROI computation ──────────────────────────────────────────────────────────

export function computeROI(
  event: {
    eventType: string;
    sponsorshipCost: number | null;
    attendanceEstimate: number | null;
  },
  profile: CompanyProfileForROI,
  overrides: ROIUserOverrides = {}
): ROIResult {
  const type = normalizeEventType(event.eventType);
  const overhead = profile.overheadPerEventJson?.[type] ?? 0;

  // ── estimatedCost ──
  let estimatedCostSource: ROIInputRow["source"] = "event listing";
  let estimatedCost: number | null = null;

  if (overrides.estimatedCost !== undefined) {
    estimatedCost = overrides.estimatedCost;
    estimatedCostSource = "user override";
  } else if (event.sponsorshipCost !== null) {
    estimatedCost = event.sponsorshipCost;
    estimatedCostSource = "event listing";
  } else {
    estimatedCost = overhead > 0 ? overhead : null;
    estimatedCostSource = "company default";
  }

  // ── estimatedLeads ──
  let estimatedLeadsSource: ROIInputRow["source"] = "computed";
  let estimatedLeads: number | null = null;

  if (overrides.estimatedLeads !== undefined) {
    estimatedLeads = overrides.estimatedLeads;
    estimatedLeadsSource = "user override";
  } else if (event.attendanceEstimate !== null) {
    estimatedLeads = Math.round(event.attendanceEstimate * CONVERSION_RATE[type]);
    estimatedLeadsSource = "computed";
  } else {
    const defaultLeads = profile.leadEstimatesJson?.[type];
    if (defaultLeads && defaultLeads > 0) {
      estimatedLeads = defaultLeads;
      estimatedLeadsSource = "company default";
    } else {
      estimatedLeads = null;
    }
  }

  // ── avgDealValue ──
  const avgDealValue =
    overrides.avgDealValue !== undefined ? overrides.avgDealValue : profile.avgDealValue ?? 0;
  const avgDealValueSource: ROIInputRow["source"] =
    overrides.avgDealValue !== undefined ? "user override" : "company default";

  // ── leadToOppRate ──
  const leadToOppRate =
    overrides.leadToOppRate !== undefined ? overrides.leadToOppRate : profile.leadToOppRate ?? 0;
  const leadToOppRateSource: ROIInputRow["source"] =
    overrides.leadToOppRate !== undefined ? "user override" : "company default";

  // ── CPL ──
  let cplLow: number | null = null;
  let cplHigh: number | null = null;

  if (estimatedCost !== null && estimatedLeads !== null && estimatedLeads > 0) {
    const cplPoint = estimatedCost / estimatedLeads;
    cplLow = Math.round(cplPoint * 0.8);
    cplHigh = Math.round(cplPoint * 1.2);
  }

  // ── Pipeline & ROI ──
  let estimatedPipeline: number | null = null;
  let totalCost: number | null = null;
  let roiMultiplier: number | null = null;

  if (estimatedLeads !== null && avgDealValue > 0) {
    estimatedPipeline = estimatedLeads * avgDealValue * (leadToOppRate / 100);
  }

  if (estimatedCost !== null) {
    totalCost = estimatedCost + overhead;
  }

  if (estimatedPipeline !== null && totalCost !== null && totalCost > 0) {
    roiMultiplier = (estimatedPipeline - totalCost) / totalCost;
  }

  // ── ROI label ──
  let roiLabel: ROIResult["roiLabel"] = "Unknown";
  if (roiMultiplier !== null) {
    if (roiMultiplier >= 3) roiLabel = "Strong";
    else if (roiMultiplier >= 1) roiLabel = "Moderate";
    else if (roiMultiplier >= 0) roiLabel = "Weak";
    else roiLabel = "Unknown";
  }

  // ── Inputs table ──
  const calculationInputs: ROIInputRow[] = [
    {
      label: "Estimated cost",
      value: formatMoney(estimatedCost),
      source: estimatedCostSource,
    },
    {
      label: "Estimated leads",
      value: estimatedLeads !== null ? String(estimatedLeads) : "—",
      source: estimatedLeadsSource,
    },
    {
      label: "Avg deal value",
      value: formatMoney(avgDealValue),
      source: avgDealValueSource,
    },
    {
      label: "Lead-to-opp rate",
      value: `${leadToOppRate}%`,
      source: leadToOppRateSource,
    },
    {
      label: "Overhead",
      value: formatMoney(overhead),
      source: "company default",
    },
    {
      label: "Pipeline value",
      value: formatMoney(estimatedPipeline),
      source: "computed",
    },
    {
      label: "Total cost",
      value: formatMoney(totalCost),
      source: "computed",
    },
  ];

  return {
    estimatedCost,
    estimatedLeads,
    cplLow,
    cplHigh,
    estimatedPipeline,
    totalCost,
    roiMultiplier:
      roiMultiplier !== null ? Math.round(roiMultiplier * 10) / 10 : null,
    roiLabel,
    calculationInputs,
  };
}
