"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Check,
  Sparkles,
  Copy,
  RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreExplanations {
  audienceMatch?: string;
  topicRelevance?: string;
  strategicAlignment?: string;
  budgetFit?: string;
  competitorSignal?: string;
  sentiment?: string;
}

interface EventScore {
  audienceMatch: number;
  topicRelevance: number;
  strategicAlignment: number;
  budgetFit: number;
  competitorSignal: number;
  sentiment: number;
  totalScore: number;
  confidence: string;
  scoreExplanationJson: ScoreExplanations;
  updatedAt: string;
}

interface ROIInputRow {
  label: string;
  value: string;
  source: string;
}

interface EventROI {
  estimatedCost: number | null;
  estimatedLeads: number | null;
  cplLow: number | null;
  cplHigh: number | null;
  estimatedPipeline: number | null;
  roiMultiplier: number | null;
  roiLabel: string;
  calculationInputsJson: ROIInputRow[];
  userOverridesJson: {
    estimatedCost?: number;
    estimatedLeads?: number;
    avgDealValue?: number;
    leadToOppRate?: number;
  };
  updatedAt: string;
}

interface PlanningStatus {
  status: string;
  owner: string;
  notes: string;
  updatedAt: string;
}

interface MessagingAngle {
  angle: string;
  detail: string;
}

interface CfpAngle {
  title: string;
  abstract: string;
}

interface EventStrategy {
  id: string;
  recommendationType: string;
  recommendationReason: string;
  messagingJson: MessagingAngle[];
  talkingPointsText: string;
  staffingText: string;
  sideEventsText: string;
  partnerOpportunitiesText: string;
  cfpAnglesJson: CfpAngle[];
  cfpDraftText: string;
  generatedAt: string;
}

interface CompetitorSignal {
  id: string;
  competitorName: string;
  sponsorStatus: string;
  sponsorTier: string;
  evidenceText: string;
  confidence: string;
  updatedAt: string;
}

interface EventDetail {
  id: string;
  name: string;
  url: string;
  organizer: string;
  startDate: string | null;
  endDate: string | null;
  city: string;
  country: string;
  region: string;
  description: string;
  topicsJson: string[];
  eventType: string;
  attendanceEstimate: number | null;
  sponsorshipCost: number | null;
  sponsorshipInfoText: string;
  cfpDeadline: string | null;
  cfpInfoText: string;
  source: string;
  score: EventScore | null;
  roi: EventROI | null;
  planningStatus: PlanningStatus | null;
  strategy: EventStrategy | null;
  competitorSignals: CompetitorSignal[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

function scoreCircleColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

function confidenceBadge(level: string) {
  const map: Record<string, string> = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  };
  return map[level] ?? map.low;
}

function cfpStatusInfo(cfpDeadline: string | null): { label: string; color: string } {
  if (!cfpDeadline) return { label: "Unknown", color: "bg-gray-100 text-gray-500" };
  const diff = new Date(cfpDeadline).getTime() - Date.now();
  if (diff < 0) return { label: "Closed", color: "bg-gray-100 text-gray-500" };
  return { label: "Open", color: "bg-teal-100 text-teal-700" };
}

function daysUntil(d: string | null): string {
  if (!d) return "";
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Closed ${Math.abs(diff)} days ago`;
  if (diff === 0) return "Closes today";
  return `${diff} days remaining`;
}

function recommendationBadgeColor(type: string): string {
  switch (type) {
    case "Sponsor": return "bg-blue-100 text-blue-800 border border-blue-200";
    case "Speak": return "bg-green-100 text-green-800 border border-green-200";
    case "Attend": return "bg-amber-100 text-amber-800 border border-amber-200";
    case "Pass": return "bg-gray-100 text-gray-600 border border-gray-200";
    default: return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SubScoreRowProps {
  label: string;
  weight: string;
  score: number;
  explanation: string;
}

function SubScoreRow({ label, weight, score, explanation }: SubScoreRowProps) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className="text-xs text-gray-400">{weight}</span>
        </div>
        <span className={`text-sm font-semibold ${scoreColor(score)}`}>{Math.round(score)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mb-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${scoreBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {explanation && <p className="text-xs text-gray-400 leading-relaxed">{explanation}</p>}
    </div>
  );
}

interface ScoreCircleProps {
  score: number;
}

function ScoreCircle({ score }: ScoreCircleProps) {
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  const color = scoreCircleColor(score);

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        className="rotate-90"
        transform="rotate(90, 50, 50)"
        fill={color}
        fontSize="20"
        fontWeight="700"
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
      <Sparkles className="h-3 w-3" />
      AI-generated
    </span>
  );
}

// ─── Talking points renderer ──────────────────────────────────────────────────

function TalkingPoints({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => {
        const cleaned = line.replace(/^[-*•]\s*/, "");
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            {cleaned}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Strategy state
  const [strategy, setStrategy] = useState<EventStrategy | null>(null);
  const [strategyGenerating, setStrategyGenerating] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  // Override state
  const [overrideType, setOverrideType] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);

  // CFP expand state
  const [cfpAnglesOpen, setCfpAnglesOpen] = useState<boolean[]>([false, false, false]);
  const [cfpDraftOpen, setCfpDraftOpen] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Rescore state
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState<string | null>(null);

  // ROI overrides state
  const [roiOpen, setRoiOpen] = useState(false);
  const [roiCalcOpen, setRoiCalcOpen] = useState(false);
  const [roiOverrides, setRoiOverrides] = useState<{
    estimatedCost: string;
    estimatedLeads: string;
    avgDealValue: string;
    leadToOppRate: string;
  }>({ estimatedCost: "", estimatedLeads: "", avgDealValue: "", leadToOppRate: "" });
  const [roiSaving, setRoiSaving] = useState(false);

  // Competitor intelligence state
  const [competitorSignals, setCompetitorSignals] = useState<CompetitorSignal[]>([]);
  const [competitorScanning, setCompetitorScanning] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [competitorEvidenceOpen, setCompetitorEvidenceOpen] = useState<Record<string, boolean>>({});

  // Planning status state
  const [planningStatus, setPlanningStatus] = useState<string>("candidate");
  const [planningOwner, setPlanningOwner] = useState<string>("");
  const [planningNotes, setPlanningNotes] = useState<string>("");
  const [planningSaving, setPlanningSaving] = useState(false);
  const [planningSaved, setPlanningSaved] = useState(false);

  // ── Fetch event ──
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.id}`);
      if (!res.ok) throw new Error("Event not found");
      const data = (await res.json()) as EventDetail;
      setEvent(data);

      if (data.strategy) {
        setStrategy(data.strategy);
        setOverrideType(data.strategy.recommendationType);
        setOverrideReason(data.strategy.recommendationReason);
      }

      // Pre-fill competitor signals
      if (data.competitorSignals) {
        setCompetitorSignals(data.competitorSignals);
      }

      // Pre-fill planning status
      if (data.planningStatus) {
        setPlanningStatus(data.planningStatus.status);
        setPlanningOwner(data.planningStatus.owner);
        setPlanningNotes(data.planningStatus.notes);
      }

      // Pre-fill ROI overrides
      if (data.roi?.userOverridesJson) {
        const u = data.roi.userOverridesJson;
        setRoiOverrides({
          estimatedCost: u.estimatedCost !== undefined ? String(u.estimatedCost) : "",
          estimatedLeads: u.estimatedLeads !== undefined ? String(u.estimatedLeads) : "",
          avgDealValue: u.avgDealValue !== undefined ? String(u.avgDealValue) : "",
          leadToOppRate: u.leadToOppRate !== undefined ? String(u.leadToOppRate) : "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // ── Generate / regenerate strategy ──
  const handleGenerateStrategy = async () => {
    setStrategyGenerating(true);
    setStrategyError(null);
    try {
      const res = await fetch(`/api/events/${params.id}/strategy`, { method: "POST" });
      if (!res.ok) throw new Error("Strategy generation failed");
      const newStrategy = (await res.json()) as EventStrategy;
      setStrategy(newStrategy);
      setOverrideType(newStrategy.recommendationType);
      setOverrideReason(newStrategy.recommendationReason);
      setEvent((prev) => prev ? { ...prev, strategy: newStrategy } : prev);
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStrategyGenerating(false);
    }
  };

  // ── Save override ──
  const handleSaveOverride = async () => {
    setOverrideSaving(true);
    try {
      const res = await fetch(`/api/events/${params.id}/strategy-override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationType: overrideType, recommendationReason: overrideReason }),
      });
      if (!res.ok) throw new Error("Override failed");
      const updated = (await res.json()) as EventStrategy;
      setStrategy((prev) => prev ? { ...prev, recommendationType: updated.recommendationType, recommendationReason: updated.recommendationReason } : prev);
      setOverrideSaved(true);
      setTimeout(() => setOverrideSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Rescore ──
  const handleRescore = async () => {
    setRescoring(true);
    setRescoreMsg(null);
    try {
      const res = await fetch(`/api/events/${params.id}/score`, { method: "POST" });
      if (!res.ok) throw new Error("Scoring failed");
      const newScore = await res.json();
      setEvent((prev) => prev ? { ...prev, score: newScore } : prev);
      setRescoreMsg("Rescored successfully");
      setTimeout(() => setRescoreMsg(null), 3000);
    } catch {
      setRescoreMsg("Scoring failed");
    } finally {
      setRescoring(false);
    }
  };

  // ── ROI recalculate ──
  const handleROIRecalculate = async () => {
    setRoiSaving(true);
    try {
      const body: Record<string, number> = {};
      if (roiOverrides.estimatedCost !== "") body.estimatedCost = parseFloat(roiOverrides.estimatedCost);
      if (roiOverrides.estimatedLeads !== "") body.estimatedLeads = parseInt(roiOverrides.estimatedLeads);
      if (roiOverrides.avgDealValue !== "") body.avgDealValue = parseFloat(roiOverrides.avgDealValue);
      if (roiOverrides.leadToOppRate !== "") body.leadToOppRate = parseFloat(roiOverrides.leadToOppRate);

      const res = await fetch(`/api/events/${params.id}/roi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("ROI update failed");
      const newRoi = await res.json();
      setEvent((prev) => prev ? { ...prev, roi: newRoi } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setRoiSaving(false);
    }
  };

  // ── Scan competitors ──
  const handleScanCompetitors = async () => {
    setCompetitorScanning(true);
    setCompetitorError(null);
    try {
      const res = await fetch(`/api/events/${params.id}/competitors`, { method: "POST" });
      if (!res.ok) throw new Error("Competitor scan failed");
      const data = await res.json() as { results: CompetitorSignal[] };
      setCompetitorSignals(data.results ?? []);
      // Silently trigger rescore in background
      fetch(`/api/events/${params.id}/score`, { method: "POST" }).catch(() => {});
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setCompetitorScanning(false);
    }
  };

  // ── Save planning status ──
  const handleSavePlanning = async () => {
    setPlanningSaving(true);
    try {
      const res = await fetch(`/api/events/${params.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: planningStatus, owner: planningOwner, notes: planningNotes }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setEvent((prev) => prev ? { ...prev, planningStatus: updated } : prev);
      setPlanningSaved(true);
      setTimeout(() => setPlanningSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setPlanningSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-500">Loading event…</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <a href="/events" className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mb-4">
            ← Back to Event Explorer
          </a>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error ?? "Event not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const score = event.score;
  const roi = event.roi;
  const topics = Array.isArray(event.topicsJson) ? event.topicsJson : [];
  const hasCFP = event.cfpDeadline || (event.cfpInfoText && event.cfpInfoText !== "unknown");
  const cfp = cfpStatusInfo(event.cfpDeadline);

  const cplDisplay =
    roi?.cplLow !== null && roi?.cplLow !== undefined && roi?.cplHigh !== null && roi?.cplHigh !== undefined
      ? `${formatMoney(roi.cplLow)} – ${formatMoney(roi.cplHigh)} CPL`
      : "CPL unknown";

  const roiDisplay =
    roi?.roiMultiplier !== null && roi?.roiMultiplier !== undefined
      ? `${roi.roiMultiplier}× ROI — ${roi.roiLabel}`
      : "ROI unknown";

  const calcInputs: ROIInputRow[] = Array.isArray(roi?.calculationInputsJson)
    ? (roi.calculationInputsJson as ROIInputRow[])
    : [];

  const messagingAngles: MessagingAngle[] = Array.isArray(strategy?.messagingJson)
    ? (strategy.messagingJson as MessagingAngle[])
    : [];

  const cfpAngles: CfpAngle[] = Array.isArray(strategy?.cfpAnglesJson)
    ? (strategy.cfpAnglesJson as CfpAngle[])
    : [];

  const toggleCfpAngle = (i: number) => {
    setCfpAnglesOpen((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <a
          href="/events"
          className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mb-5"
        >
          ← Back to Event Explorer
        </a>

        {/* ── Header Card ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                  {event.eventType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                  via {event.source}
                </span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Location</dt>
                  <dd>{event.city}, {event.country} ({event.region})</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Dates</dt>
                  <dd>
                    {formatDate(event.startDate)}
                    {event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Organizer</dt>
                  <dd>{event.organizer}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Attendance</dt>
                  <dd>{event.attendanceEstimate !== null ? event.attendanceEstimate.toLocaleString() : "—"}</dd>
                </div>
                {event.sponsorshipCost !== null && (
                  <div>
                    <dt className="text-xs text-gray-400 uppercase tracking-wide">Sponsorship cost</dt>
                    <dd>{formatMoney(event.sponsorshipCost)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0 items-end">
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
                >
                  Event website <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={handleRescore}
                disabled={rescoring}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {rescoring ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Rescore
              </button>
              {rescoreMsg && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {rescoreMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content (left, 2/3) ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Fit Score section ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Fit Score</h2>
                {score && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${confidenceBadge(score.confidence)}`}
                  >
                    {score.confidence} confidence
                  </span>
                )}
              </div>

              {score ? (
                <div>
                  <div className="flex items-center gap-5 mb-6">
                    <ScoreCircle score={score.totalScore} />
                    <div>
                      <p className="text-sm text-gray-500">Total score</p>
                      <p className={`text-4xl font-bold ${scoreColor(score.totalScore)}`}>
                        {Math.round(score.totalScore)}
                        <span className="text-lg font-normal text-gray-400">/100</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Last updated {new Date(score.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <SubScoreRow
                      label="Audience Match"
                      weight="25%"
                      score={score.audienceMatch}
                      explanation={score.scoreExplanationJson?.audienceMatch ?? ""}
                    />
                    <SubScoreRow
                      label="Topic Relevance"
                      weight="25%"
                      score={score.topicRelevance}
                      explanation={score.scoreExplanationJson?.topicRelevance ?? ""}
                    />
                    <SubScoreRow
                      label="Strategic Alignment"
                      weight="20%"
                      score={score.strategicAlignment}
                      explanation={score.scoreExplanationJson?.strategicAlignment ?? ""}
                    />
                    <SubScoreRow
                      label="Budget Fit"
                      weight="15%"
                      score={score.budgetFit}
                      explanation={score.scoreExplanationJson?.budgetFit ?? ""}
                    />
                    <SubScoreRow
                      label="Competitor Signal"
                      weight="10%"
                      score={score.competitorSignal}
                      explanation={score.scoreExplanationJson?.competitorSignal ?? ""}
                    />
                    <SubScoreRow
                      label="Sentiment"
                      weight="5%"
                      score={score.sentiment}
                      explanation={score.scoreExplanationJson?.sentiment ?? ""}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm mb-3">No score computed yet.</p>
                  <button
                    onClick={handleRescore}
                    disabled={rescoring}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {rescoring ? "Scoring…" : "Compute score"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Recommendation section ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Recommendation</h2>
                {strategy && <AiBadge />}
              </div>

              {strategy ? (
                <div>
                  {/* Badge */}
                  <div className="mb-3">
                    <span
                      className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${recommendationBadgeColor(strategy.recommendationType)}`}
                    >
                      {strategy.recommendationType}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-gray-700 leading-relaxed mb-5">
                    {strategy.recommendationReason}
                  </p>

                  {/* Override form */}
                  <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Override recommendation
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                        <select
                          value={overrideType}
                          onChange={(e) => setOverrideType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="Sponsor">Sponsor</option>
                          <option value="Speak">Speak</option>
                          <option value="Attend">Attend</option>
                          <option value="Pass">Pass</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                        <textarea
                          rows={3}
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Override reason…"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      <button
                        onClick={handleSaveOverride}
                        disabled={overrideSaving}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {overrideSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : overrideSaved ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : null}
                        {overrideSaved ? "Saved" : "Save override"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 mb-4">
                    Generate a strategy brief to get a recommendation.
                  </p>
                  <button
                    onClick={handleGenerateStrategy}
                    disabled={strategyGenerating}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-60"
                  >
                    {strategyGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {strategyGenerating ? "Generating with Claude…" : "Generate strategy brief"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Strategy Brief section ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Strategy Brief</h2>
                {strategy && (
                  <div className="flex items-center gap-2">
                    <AiBadge />
                    <button
                      onClick={handleGenerateStrategy}
                      disabled={strategyGenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                    >
                      {strategyGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Regenerate
                    </button>
                  </div>
                )}
              </div>

              {strategyError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {strategyError}
                </div>
              )}

              {!strategy ? (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-purple-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">
                    No strategy brief yet. Generate one to get messaging angles, staffing guidance, CFP talk angles, and more.
                  </p>
                  <button
                    onClick={handleGenerateStrategy}
                    disabled={strategyGenerating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
                  >
                    {strategyGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {strategyGenerating ? "Generating with Claude…" : "Generate strategy brief"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Messaging angles */}
                  {messagingAngles.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Messaging Angles</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {messagingAngles.map((m, i) => (
                          <div
                            key={i}
                            className="border border-indigo-100 bg-indigo-50 rounded-lg p-3"
                          >
                            <p className="text-xs font-semibold text-indigo-800 mb-1">{m.angle}</p>
                            <p className="text-xs text-indigo-700 leading-relaxed">{m.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Talking points */}
                  {strategy.talkingPointsText && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Talking Points</h3>
                      <TalkingPoints text={strategy.talkingPointsText} />
                    </div>
                  )}

                  {/* Staffing */}
                  {strategy.staffingText && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Staffing</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{strategy.staffingText}</p>
                    </div>
                  )}

                  {/* Side events */}
                  {strategy.sideEventsText && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Side Events</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{strategy.sideEventsText}</p>
                    </div>
                  )}

                  {/* Partner opportunities */}
                  {strategy.partnerOpportunitiesText && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Partner Opportunities</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{strategy.partnerOpportunitiesText}</p>
                    </div>
                  )}

                  {/* AI disclaimer */}
                  <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
                    <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                    AI-generated suggestion — review and adapt before sharing externally.
                    {strategy.generatedAt && (
                      <span className="ml-auto text-purple-500">
                        Generated {new Date(strategy.generatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Competitor Intelligence section ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Competitor Intelligence</h2>
                {competitorSignals.length > 0 && (
                  <button
                    onClick={handleScanCompetitors}
                    disabled={competitorScanning}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {competitorScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </button>
                )}
              </div>

              {competitorError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {competitorError}
                </div>
              )}

              {competitorSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <p className="text-sm text-gray-500">
                    No competitor data yet. Scan the event website to check for competitor presence.
                  </p>
                  <button
                    onClick={handleScanCompetitors}
                    disabled={competitorScanning}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {competitorScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {competitorScanning ? "Scanning…" : "Check competitor presence"}
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary line */}
                  <div className="mb-4 text-sm text-gray-600">
                    {(() => {
                      const found = competitorSignals.filter((s) => s.sponsorStatus === "yes");
                      return found.length > 0 ? (
                        <span className="text-red-600 font-medium">
                          {found.length} competitor{found.length !== 1 ? "s" : ""} detected:{" "}
                          {found.map((s) => s.competitorName).join(", ")}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">No competitors detected at this event.</span>
                      );
                    })()}
                  </div>

                  {/* Competitor rows */}
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden mb-4">
                    {competitorSignals.map((signal) => {
                      const isSponsoring = signal.sponsorStatus === "yes";
                      const isNotFound = signal.sponsorStatus === "no";
                      const evidenceOpen = competitorEvidenceOpen[signal.id] ?? false;
                      return (
                        <div key={signal.id} className="p-3 bg-white hover:bg-gray-50">
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Name */}
                            <span className="text-sm font-medium text-gray-900 flex-1 min-w-[120px]">
                              {signal.competitorName}
                            </span>

                            {/* Status badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isSponsoring
                                  ? "bg-red-100 text-red-700"
                                  : isNotFound
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {isSponsoring ? "Sponsoring" : isNotFound ? "Not found" : "Unknown"}
                            </span>

                            {/* Tier */}
                            {isSponsoring && signal.sponsorTier && signal.sponsorTier !== "unknown" && (
                              <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                                {signal.sponsorTier}
                              </span>
                            )}

                            {/* Confidence */}
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceBadge(signal.confidence)}`}
                            >
                              {signal.confidence} confidence
                            </span>

                            {/* Evidence toggle */}
                            {signal.evidenceText && (
                              <button
                                onClick={() =>
                                  setCompetitorEvidenceOpen((prev) => ({
                                    ...prev,
                                    [signal.id]: !prev[signal.id],
                                  }))
                                }
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                {evidenceOpen ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                Evidence
                              </button>
                            )}
                          </div>

                          {/* Collapsible evidence snippet */}
                          {signal.evidenceText && evidenceOpen && (
                            <div className="mt-2 ml-1 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 italic leading-relaxed">
                              &ldquo;{signal.evidenceText}&rdquo;
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Last scanned */}
                  {competitorSignals[0]?.updatedAt && (
                    <p className="text-xs text-gray-400">
                      Last scanned {new Date(competitorSignals[0].updatedAt).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* ── CPL & ROI section ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 text-lg mb-4">CPL &amp; ROI</h2>

              {/* Summary */}
              <div className="flex flex-wrap gap-6 mb-5">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cost per Lead</p>
                  <p className="text-xl font-bold text-gray-900">{cplDisplay}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">ROI Estimate</p>
                  <p
                    className={`text-xl font-bold ${
                      roi?.roiLabel === "Strong"
                        ? "text-green-600"
                        : roi?.roiLabel === "Moderate"
                        ? "text-yellow-600"
                        : roi?.roiLabel === "Weak"
                        ? "text-orange-500"
                        : "text-gray-400"
                    }`}
                  >
                    {roiDisplay}
                  </p>
                </div>
              </div>

              {/* Collapsible calc details */}
              <button
                onClick={() => setRoiCalcOpen(!roiCalcOpen)}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mb-4"
              >
                {roiCalcOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                How this was calculated
              </button>

              {roiCalcOpen && calcInputs.length > 0 && (
                <div className="mb-4 border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2 font-medium">Input</th>
                        <th className="text-right px-4 py-2 font-medium">Value</th>
                        <th className="text-right px-4 py-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcInputs.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-700">{row.label}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900">{row.value}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                row.source === "user override"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : row.source === "event listing"
                                  ? "bg-blue-50 text-blue-700"
                                  : row.source === "computed"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {row.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Editable overrides */}
              <button
                onClick={() => setRoiOpen(!roiOpen)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                {roiOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Override inputs
              </button>

              {roiOpen && (
                <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Estimated cost ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={roiOverrides.estimatedCost}
                        placeholder={String(roi?.estimatedCost ?? "")}
                        onChange={(e) =>
                          setRoiOverrides((p) => ({ ...p, estimatedCost: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Estimated leads (#)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={roiOverrides.estimatedLeads}
                        placeholder={String(roi?.estimatedLeads ?? "")}
                        onChange={(e) =>
                          setRoiOverrides((p) => ({ ...p, estimatedLeads: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Avg deal value ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={roiOverrides.avgDealValue}
                        onChange={(e) =>
                          setRoiOverrides((p) => ({ ...p, avgDealValue: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Lead-to-opp rate (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={roiOverrides.leadToOppRate}
                        onChange={(e) =>
                          setRoiOverrides((p) => ({ ...p, leadToOppRate: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleROIRecalculate}
                    disabled={roiSaving}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {roiSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Recalculate
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-400 italic">
                ROI and CPL are directional estimates, not financial advice.
              </p>
            </div>

            {/* ── Topics section ── */}
            {topics.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 text-lg mb-3">Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Description ── */}
            {event.description && event.description !== "" && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 text-lg mb-3">Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{event.description}</p>
              </div>
            )}

            {/* ── CFP section ── */}
            {hasCFP && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 text-lg mb-3">Call for Proposals</h2>

                {/* Status + deadline */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfp.color}`}>
                    {cfp.label}
                  </span>
                  {event.cfpDeadline && (
                    <span className="text-sm text-gray-600">
                      Deadline: {formatDate(event.cfpDeadline)}
                      <span className="ml-2 text-xs text-gray-400">({daysUntil(event.cfpDeadline)})</span>
                    </span>
                  )}
                </div>

                {event.cfpInfoText && event.cfpInfoText !== "unknown" && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{event.cfpInfoText}</p>
                )}

                {/* Talk angles from strategy */}
                {cfpAngles.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">Talk Angles</h3>
                      <AiBadge />
                    </div>
                    <div className="space-y-2">
                      {cfpAngles.map((angle, i) => (
                        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleCfpAngle(i)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-800">{angle.title}</span>
                            {cfpAnglesOpen[i] ? (
                              <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                          </button>
                          {cfpAnglesOpen[i] && (
                            <div className="px-4 py-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                              {angle.abstract}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CFP Draft */}
                {strategy?.cfpDraftText ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-700">Proposal Draft</h3>
                        <AiBadge />
                      </div>
                      <button
                        onClick={() => setCfpDraftOpen(!cfpDraftOpen)}
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {cfpDraftOpen ? "Hide" : "Show full abstract"}
                        {cfpDraftOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {cfpDraftOpen && (
                      <div className="relative">
                        <textarea
                          readOnly
                          value={strategy.cfpDraftText}
                          rows={10}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono resize-none"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(strategy.cfpDraftText);
                            setCopiedDraft(true);
                            setTimeout(() => setCopiedDraft(false), 2000);
                          }}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                        >
                          {copiedDraft ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedDraft ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Generate a strategy brief to get a proposal draft.</p>
                    <button
                      onClick={handleGenerateStrategy}
                      disabled={strategyGenerating}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-60"
                    >
                      {strategyGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {strategyGenerating ? "Generating…" : "Generate proposal draft"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar (right, 1/3) ── */}
          <div className="space-y-5">
            {/* ── Planning Status ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Planning Status</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={planningStatus}
                    onChange={(e) => setPlanningStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="candidate">Candidate</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                  <input
                    type="text"
                    value={planningOwner}
                    onChange={(e) => setPlanningOwner(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={planningNotes}
                    onChange={(e) => setPlanningNotes(e.target.value)}
                    placeholder="Internal notes…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleSavePlanning}
                  disabled={planningSaving}
                  className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {planningSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : planningSaved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {planningSaved ? "Saved" : "Save status"}
                </button>
                {event.planningStatus?.updatedAt && (
                  <p className="text-xs text-gray-400">
                    Last saved {new Date(event.planningStatus.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* ── Event meta ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Event Details</h3>
              <dl className="space-y-2 text-sm">
                {[
                  { label: "Date", value: formatDate(event.startDate) },
                  { label: "Location", value: `${event.city}, ${event.country}` },
                  { label: "Region", value: event.region },
                  {
                    label: "Attendance",
                    value: event.attendanceEstimate !== null
                      ? event.attendanceEstimate.toLocaleString()
                      : "—",
                  },
                  {
                    label: "Sponsorship cost",
                    value: formatMoney(event.sponsorshipCost),
                  },
                  { label: "CFP deadline", value: formatDate(event.cfpDeadline) },
                  { label: "Organizer", value: event.organizer },
                  { label: "Source", value: event.source },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <dt className="text-gray-400">{label}</dt>
                    <dd className="text-gray-700 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
