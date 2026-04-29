"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventScore {
  totalScore: number;
  audienceMatch: number;
  topicRelevance: number;
  strategicAlignment: number;
  budgetFit: number;
  competitorSignal: number;
  sentiment: number;
  confidence: string;
}

interface EventROI {
  cplLow: number | null;
  cplHigh: number | null;
  roiLabel: string;
  estimatedLeads: number | null;
}

interface PlanningStatus {
  status: string;
}

interface Event {
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
  cfpDeadline: string | null;
  source: string;
  score: EventScore | null;
  roi: EventROI | null;
  planningStatus: PlanningStatus | null;
  hasCompetitors: boolean;
}

interface CplTargets {
  conference?: number;
  meetup?: number;
  analyst?: number;
  community?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS = ["Europe", "North America", "APAC", "MENA", "Global"];
const TYPES = ["conference", "meetup", "community", "analyst"];
const SOURCES = ["luma", "web"];
const STATUSES = ["candidate", "shortlisted", "approved", "rejected"];
const SORT_OPTIONS = [
  { value: "score_desc", label: "Score ↓" },
  { value: "date_asc", label: "Date ↑" },
  { value: "cpl_asc", label: "CPL ↑" },
  { value: "region_asc", label: "Region A→Z" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;

  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  const sMonth = monthFmt.format(s);
  const sDay = s.getUTCDate();
  const sYear = s.getUTCFullYear();

  if (!e) return `${sMonth} ${sDay}, ${sYear}`;

  const eMonth = monthFmt.format(e);
  const eDay = e.getUTCDate();
  const eYear = e.getUTCFullYear();

  if (sYear === eYear && sMonth === eMonth) {
    return `${sMonth} ${sDay}–${eDay}, ${sYear}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
}

function isCfpOpen(cfpDeadline: string | null): boolean | null {
  if (!cfpDeadline) return null;
  return new Date(cfpDeadline) > new Date();
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

function scoreRingColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#ca8a04";
  return "#ef4444";
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "conference": return "bg-blue-100 text-blue-800";
    case "meetup": return "bg-green-100 text-green-800";
    case "community": return "bg-purple-100 text-purple-800";
    case "analyst": return "bg-orange-100 text-orange-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function sourceBadgeColor(source: string): string {
  return source === "luma"
    ? "bg-yellow-100 text-yellow-800"
    : "bg-gray-100 text-gray-700";
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case "shortlisted": return "bg-blue-100 text-blue-800";
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

function cplBadgeColor(cplLow: number | null, cplHigh: number | null, target: number): string {
  if (cplLow === null || cplHigh === null) return "bg-gray-100 text-gray-500";
  const mid = (cplLow + cplHigh) / 2;
  if (mid <= target) return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-700";
}

// Circular score badge as inline SVG
function ScoreBadge({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreRingColor(score);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="22" cy="22" r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(score)}`}
        >
          {score}
        </span>
      </div>
      <span className="text-xs text-gray-400">Score</span>
    </div>
  );
}

// ─── Filter bar sub-components ────────────────────────────────────────────────

function PillToggle({
  options,
  selected,
  onToggle,
  label,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  label: string;
}) {
  const allSelected = selected.length === 0;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 font-medium shrink-0">{label}:</span>
      <button
        onClick={() => options.forEach((o) => selected.includes(o) && onToggle(o))}
        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          allSelected
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400"
        }`}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
            selected.includes(o)
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function RegionDropdown({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? "All regions" : selected.join(", ");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-indigo-400 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="max-w-[120px] truncate">{label}</span>
        <svg className="w-3 h-3 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48">
          {REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(r)}
                onChange={() => onToggle(r)}
                className="rounded text-indigo-600"
              />
              <span className="text-sm text-gray-700">{r}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
          <div className="flex gap-2 mb-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-5 bg-gray-100 rounded-full w-16" />)}
          </div>
          <div className="h-3 bg-gray-100 rounded w-full mb-1" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
        <div className="w-12 h-12 rounded-full bg-gray-100 ml-4" />
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, cplTargets }: { event: Event; cplTargets: CplTargets }) {
  const topics = event.topicsJson ?? [];
  const visibleTopics = topics.slice(0, 3);
  const extraTopics = topics.length - 3;
  const cfpOpen = isCfpOpen(event.cfpDeadline);
  const target =
    (cplTargets[event.eventType as keyof CplTargets] ?? 0) > 0
      ? cplTargets[event.eventType as keyof CplTargets]!
      : event.eventType === "meetup"
      ? 150
      : 250;

  const cplBg = event.roi?.cplLow != null
    ? cplBadgeColor(event.roi.cplLow, event.roi.cplHigh, target)
    : "bg-gray-100 text-gray-500";

  return (
    <Link href={`/events/${event.id}`} className="block group">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md hover:border-indigo-300 transition-all duration-150 cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Left: main content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                {event.name}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeBadgeColor(event.eventType)}`}>
                {event.eventType}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sourceBadgeColor(event.source)}`}>
                {event.source}
              </span>
              {cfpOpen === true && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                  CFP Open
                </span>
              )}
              {cfpOpen === false && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  CFP Closed
                </span>
              )}
            </div>

            {/* Row 2: Date + location */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateRange(event.startDate, event.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.city}, {event.country}
                <span className="text-gray-400">· {event.region}</span>
              </span>
              {event.attendanceEstimate && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  ~{event.attendanceEstimate.toLocaleString()} attendees
                </span>
              )}
            </div>

            {/* Row 3: Topics */}
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {visibleTopics.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                    {t}
                  </span>
                ))}
                {extraTopics > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-400">
                    +{extraTopics} more
                  </span>
                )}
              </div>
            )}

            {/* Row 4: Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* CPL badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${cplBg}`}>
                {event.roi?.cplLow != null
                  ? `CPL: $${event.roi.cplLow}–$${event.roi.cplHigh}`
                  : "CPL: unknown"}
              </span>

              {/* ROI label */}
              {event.roi?.roiLabel && event.roi.roiLabel !== "Unknown" && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  event.roi.roiLabel === "Strong"
                    ? "bg-green-100 text-green-700"
                    : event.roi.roiLabel === "Moderate"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {event.roi.roiLabel} ROI
                </span>
              )}

              {/* Competitor warning */}
              {event.hasCompetitors && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  ⚠ Competitors
                </span>
              )}

              {/* Planning status */}
              {event.planningStatus && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadgeColor(event.planningStatus.status)}`}>
                  {event.planningStatus.status}
                </span>
              )}
            </div>
          </div>

          {/* Right: Score badge */}
          <div className="shrink-0">
            {event.score ? (
              <ScoreBadge score={Math.round(event.score.totalScore)} />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-12 h-12 rounded-full border-4 border-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-400">—</span>
                </div>
                <span className="text-xs text-gray-400">Score</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventExplorerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Filter state (read from URL) ──
  const [regionFilter, setRegionFilter] = useState<string[]>(
    searchParams.get("region") ? searchParams.get("region")!.split(",") : []
  );
  const [typeFilter, setTypeFilter] = useState<string[]>(
    searchParams.get("type") ? searchParams.get("type")!.split(",") : []
  );
  const [sourceFilter, setSourceFilter] = useState<string[]>(
    searchParams.get("source") ? searchParams.get("source")!.split(",") : []
  );
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status") ? searchParams.get("status")!.split(",") : []
  );
  const [startDate, setStartDate] = useState(searchParams.get("startDate") ?? "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") ?? "");
  const [minCpl, setMinCpl] = useState(searchParams.get("minCpl") ?? "");
  const [maxCpl, setMaxCpl] = useState(searchParams.get("maxCpl") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "score_desc");

  // ── Data state ──
  const [events, setEvents] = useState<Event[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cplTargets, setCplTargets] = useState<CplTargets>({});

  // ── Sync filters to URL ──
  const updateUrl = useCallback(
    (overrides: Record<string, string | string[]>) => {
      const params = new URLSearchParams();
      const vals: Record<string, string | string[]> = {
        region: regionFilter,
        type: typeFilter,
        source: sourceFilter,
        status: statusFilter,
        startDate,
        endDate,
        minCpl,
        maxCpl,
        search,
        sort,
        ...overrides,
      };
      for (const [k, v] of Object.entries(vals)) {
        const s = Array.isArray(v) ? v.join(",") : v;
        if (s) params.set(k, s);
      }
      router.replace(`/events?${params.toString()}`, { scroll: false });
    },
    [regionFilter, typeFilter, sourceFilter, statusFilter, startDate, endDate, minCpl, maxCpl, search, sort, router]
  );

  // ── Toggle helpers ──
  const toggleRegion = (v: string) => {
    const next = regionFilter.includes(v)
      ? regionFilter.filter((x) => x !== v)
      : [...regionFilter, v];
    setRegionFilter(next);
    updateUrl({ region: next });
  };

  const toggleType = (v: string) => {
    const next = typeFilter.includes(v)
      ? typeFilter.filter((x) => x !== v)
      : [...typeFilter, v];
    setTypeFilter(next);
    updateUrl({ type: next });
  };

  const toggleSource = (v: string) => {
    const next = sourceFilter.includes(v)
      ? sourceFilter.filter((x) => x !== v)
      : [...sourceFilter, v];
    setSourceFilter(next);
    updateUrl({ source: next });
  };

  const toggleStatus = (v: string) => {
    const next = statusFilter.includes(v)
      ? statusFilter.filter((x) => x !== v)
      : [...statusFilter, v];
    setStatusFilter(next);
    updateUrl({ status: next });
  };

  const resetFilters = () => {
    setRegionFilter([]);
    setTypeFilter([]);
    setSourceFilter([]);
    setStatusFilter([]);
    setStartDate("");
    setEndDate("");
    setMinCpl("");
    setMaxCpl("");
    setSearch("");
    setSort("score_desc");
    router.replace("/events", { scroll: false });
  };

  // ── Build API URL from current state ──
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (regionFilter.length) params.set("region", regionFilter.join(","));
    if (typeFilter.length) params.set("type", typeFilter.join(","));
    if (sourceFilter.length) params.set("source", sourceFilter.join(","));
    if (statusFilter.length) params.set("status", statusFilter.join(","));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (minCpl) params.set("minCpl", minCpl);
    if (maxCpl) params.set("maxCpl", maxCpl);
    if (search) params.set("search", search);
    params.set("sort", sort);
    return `/api/events?${params.toString()}`;
  }, [regionFilter, typeFilter, sourceFilter, statusFilter, startDate, endDate, minCpl, maxCpl, search, sort]);

  // ── Fetch events ──
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotalEvents(data.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiUrl]);

  // ── Fetch CPL targets from profile ──
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((profile) => {
        const targets = profile.cplTargetsJson as CplTargets;
        setCplTargets(targets ?? {});
      })
      .catch(console.error);
  }, []);

  const hasFilters =
    regionFilter.length > 0 ||
    typeFilter.length > 0 ||
    sourceFilter.length > 0 ||
    statusFilter.length > 0 ||
    startDate ||
    endDate ||
    minCpl ||
    maxCpl ||
    search;

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Explorer</h1>
            <p className="mt-1 text-gray-500 text-sm">
              Browse, filter, and evaluate conferences and meetups for Plakar.
            </p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
          >
            + Add Event
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4 space-y-3">
          {/* Row 1: Region + Type + Source + Status */}
          <div className="flex flex-wrap items-center gap-4">
            <RegionDropdown selected={regionFilter} onToggle={toggleRegion} />
            <PillToggle options={TYPES} selected={typeFilter} onToggle={toggleType} label="Type" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <PillToggle options={SOURCES} selected={sourceFilter} onToggle={toggleSource} label="Source" />
            <PillToggle options={STATUSES} selected={statusFilter} onToggle={toggleStatus} label="Status" />
          </div>

          {/* Row 2: Date range + CPL range + Search + Sort */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  updateUrl({ startDate: e.target.value });
                }}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  updateUrl({ endDate: e.target.value });
                }}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* CPL range */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">CPL $</span>
              <input
                type="number"
                placeholder="min"
                value={minCpl}
                onChange={(e) => {
                  setMinCpl(e.target.value);
                  updateUrl({ minCpl: e.target.value });
                }}
                className="h-8 w-20 px-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                type="number"
                placeholder="max"
                value={maxCpl}
                onChange={(e) => {
                  setMaxCpl(e.target.value);
                  updateUrl({ maxCpl: e.target.value });
                }}
                className="h-8 w-20 px-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Row 3: Search + Sort + Reset */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search events…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  updateUrl({ search: e.target.value });
                }}
                className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium shrink-0">Sort:</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  updateUrl({ sort: e.target.value });
                }}
                className="h-9 px-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-indigo-400 bg-white"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Reset */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-indigo-600 hover:underline ml-1"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-3">
            Showing{" "}
            <span className="font-medium text-gray-700">{events.length}</span>{" "}
            {events.length !== totalEvents && (
              <>of <span className="font-medium text-gray-700">{totalEvents}</span>{" "}</>
            )}
            event{totalEvents !== 1 ? "s" : ""}
          </p>
        )}

        {/* Event list */}
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)
          ) : events.length === 0 ? (
            /* Empty state */
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm py-20 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No events match your filters</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-xs">
                Try adjusting or clearing your filters to find more events.
              </p>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Reset filters
              </button>
            </div>
          ) : (
            events.map((event) => (
              <EventCard key={event.id} event={event} cplTargets={cplTargets} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
