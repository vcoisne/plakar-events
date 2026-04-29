"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Download,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlanningStatus {
  id: string;
  eventId: string;
  status: string;
  owner: string;
  notes: string;
  gcalEventId: string | null;
  updatedAt: string;
}

interface EventROI {
  cplLow: number | null;
  cplHigh: number | null;
  roiLabel: string;
  estimatedCost: number | null;
}

interface EventScore {
  totalScore: number;
}

interface PlanningEvent {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  eventType: string;
  startDate: string | null;
  endDate: string | null;
  planningStatus: PlanningStatus;
  roi: EventROI | null;
  score: EventScore | null;
}

interface QuarterGroup {
  key: string; // "Q1 2025"
  quarter: number;
  year: number;
  events: PlanningEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string }
> = {
  candidate: {
    label: "Candidate",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700",
  },
  shortlisted: {
    label: "Shortlisted",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  approved: {
    label: "Approved",
    color: "green",
    badgeClass: "bg-green-100 text-green-700",
  },
  rejected: {
    label: "Rejected",
    color: "red",
    badgeClass: "bg-red-100 text-red-700",
  },
};

const ALL_STATUSES = ["candidate", "shortlisted", "approved", "rejected"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getQuarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function getQuarterKey(date: Date): string {
  return `Q${getQuarter(date)} ${date.getUTCFullYear()}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const s = new Date(start);
  const sStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!end) return sStr;
  const e = new Date(end);
  const eStr = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${sStr} – ${eStr}`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

function groupByQuarter(events: PlanningEvent[]): QuarterGroup[] {
  const map = new Map<string, QuarterGroup>();
  for (const ev of events) {
    if (!ev.startDate) continue;
    const d = new Date(ev.startDate);
    const key = getQuarterKey(d);
    if (!map.has(key)) {
      map.set(key, { key, quarter: getQuarter(d), year: d.getUTCFullYear(), events: [] });
    }
    map.get(key)!.events.push(ev);
  }
  // Sort quarters chronologically
  return Array.from(map.values()).sort(
    (a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter
  );
}

function quarterCost(group: QuarterGroup): number {
  return group.events
    .filter((e) => e.planningStatus.status === "approved")
    .reduce((sum, e) => sum + (e.roi?.estimatedCost ?? 0), 0);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(events: PlanningEvent[]) {
  const headers = [
    "Name",
    "Type",
    "Region",
    "Start Date",
    "End Date",
    "City",
    "Country",
    "Status",
    "Owner",
    "CPL Low",
    "CPL High",
    "ROI Label",
    "Score",
    "Notes",
  ];
  const rows = events.map((e) => [
    e.name,
    e.eventType,
    e.region,
    e.startDate ?? "",
    e.endDate ?? "",
    e.city,
    e.country,
    e.planningStatus.status,
    e.planningStatus.owner,
    e.roi?.cplLow?.toFixed(0) ?? "",
    e.roi?.cplHigh?.toFixed(0) ?? "",
    e.roi?.roiLabel ?? "",
    e.score?.totalScore?.toFixed(1) ?? "",
    e.planningStatus.notes,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plakar-events-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMessage {
  id: number;
  type: "success" | "warning";
  text: string;
}

let toastId = 0;

// ─── Status dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({
  eventId,
  currentStatus,
  onChanged,
}: {
  eventId: string;
  currentStatus: string;
  onChanged: (eventId: string, newStatus: string, gcalError?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(
    async (newStatus: string) => {
      if (newStatus === currentStatus) {
        setOpen(false);
        return;
      }
      setOpen(false);
      setSaving(true);
      try {
        const res = await fetch(`/api/events/${eventId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = await res.json();
        onChanged(eventId, newStatus, data.gcalError);
      } catch {
        onChanged(eventId, newStatus, "Network error");
      } finally {
        setSaving(false);
      }
    },
    [eventId, currentStatus, onChanged]
  );

  const cfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.candidate;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass} hover:opacity-80 transition-opacity cursor-pointer`}
        title={currentStatus === "approved" ? "Synced to Google Calendar" : undefined}
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            {cfg.label}
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] py-1 overflow-hidden">
            {ALL_STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                    s === currentStatus ? "font-semibold" : ""
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    s === "candidate" ? "bg-gray-400" :
                    s === "shortlisted" ? "bg-blue-400" :
                    s === "approved" ? "bg-green-500" :
                    "bg-red-400"
                  }`} />
                  {c.label}
                  {s === "approved" && (
                    <span className="ml-auto text-gray-400" title="Will sync to Google Calendar">
                      <Calendar className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Budget bar ───────────────────────────────────────────────────────────────

function BudgetBar({
  groups,
  totalBudget,
}: {
  groups: QuarterGroup[];
  totalBudget: number;
}) {
  const totalCommitted = groups.reduce((sum, g) => sum + quarterCost(g), 0);
  const pct = totalBudget > 0 ? Math.min((totalCommitted / totalBudget) * 100, 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 text-sm">Budget Overview</h2>
        <span className="text-xs text-gray-500">
          Total committed:{" "}
          <span className="font-semibold text-gray-800">
            {formatCurrency(totalCommitted)}
          </span>
          {totalBudget > 0 && (
            <> of {formatCurrency(totalBudget)} annual budget</>
          )}
        </span>
      </div>

      {totalBudget > 0 && (
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all ${
              pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-indigo-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {groups.map((g) => {
          const cost = quarterCost(g);
          const approvedCount = g.events.filter(
            (e) => e.planningStatus.status === "approved"
          ).length;
          return (
            <div key={g.key} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs font-medium text-gray-600">{g.key}</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(cost)}
              </p>
              <p className="text-xs text-gray-400">
                {approvedCount} approved event{approvedCount !== 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onStatusChanged,
}: {
  event: PlanningEvent;
  onStatusChanged: (eventId: string, newStatus: string, gcalError?: string) => void;
}) {
  const isRejected = event.planningStatus.status === "rejected";

  return (
    <div
      className={`flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
        isRejected ? "opacity-50" : ""
      }`}
    >
      {/* Name + location */}
      <div className="flex-1 min-w-[180px]">
        <Link
          href={`/events/${event.id}`}
          className={`text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline ${
            isRejected ? "line-through text-gray-400" : ""
          }`}
        >
          {event.name}
        </Link>
        <p className="text-xs text-gray-500">
          {event.city}, {event.country}
        </p>
      </div>

      {/* Date */}
      <div className="w-36 text-xs text-gray-600 pt-0.5">
        {formatDateRange(event.startDate, event.endDate)}
      </div>

      {/* Type */}
      <div className="w-24">
        <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 capitalize">
          {event.eventType}
        </span>
      </div>

      {/* CPL */}
      <div className="w-28 text-xs text-gray-600 pt-0.5">
        {event.roi?.cplLow != null && event.roi?.cplHigh != null ? (
          <>
            ${event.roi.cplLow.toFixed(0)}–${event.roi.cplHigh.toFixed(0)} CPL
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>

      {/* ROI label */}
      <div className="w-20">
        {event.roi?.roiLabel && event.roi.roiLabel !== "Unknown" ? (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              event.roi.roiLabel === "Strong"
                ? "bg-green-100 text-green-700"
                : event.roi.roiLabel === "Moderate"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {event.roi.roiLabel}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      {/* Status dropdown */}
      <div className="w-28">
        <StatusDropdown
          eventId={event.id}
          currentStatus={event.planningStatus.status}
          onChanged={onStatusChanged}
        />
      </div>

      {/* Owner */}
      <div className="w-28 text-xs text-gray-500 pt-0.5 truncate">
        {event.planningStatus.owner || <span className="text-gray-300">—</span>}
      </div>

      {/* Notes */}
      {event.planningStatus.notes && (
        <div
          className="w-full text-xs text-gray-400 truncate pl-0 mt-0.5"
          title={event.planningStatus.notes}
        >
          {event.planningStatus.notes.length > 80
            ? event.planningStatus.notes.slice(0, 80) + "…"
            : event.planningStatus.notes}
        </div>
      )}
    </div>
  );
}

// ─── Quarter section ──────────────────────────────────────────────────────────

function QuarterSection({
  group,
  onStatusChanged,
}: {
  group: QuarterGroup;
  onStatusChanged: (eventId: string, newStatus: string, gcalError?: string) => void;
}) {
  const cost = quarterCost(group);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">
          {group.key}
          <span className="ml-2 text-gray-400 font-normal">
            — {group.events.length} event{group.events.length !== 1 ? "s" : ""}
            {cost > 0 && `, ${formatCurrency(cost)} estimated`}
          </span>
        </h3>
      </div>
      {/* Column header */}
      <div className="flex flex-wrap gap-x-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
        <span className="flex-1 min-w-[180px]">Event</span>
        <span className="w-36">Dates</span>
        <span className="w-24">Type</span>
        <span className="w-28">CPL</span>
        <span className="w-20">ROI</span>
        <span className="w-28">Status</span>
        <span className="w-28">Owner</span>
      </div>
      {group.events.map((ev) => (
        <EventRow key={ev.id} event={ev} onStatusChanged={onStatusChanged} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanningBoardPage() {
  const [allEvents, setAllEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBudget, setTotalBudget] = useState(0);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    new Set(ALL_STATUSES)
  );
  const [showRejected, setShowRejected] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load events and profile
  useEffect(() => {
    Promise.all([
      fetch("/api/planning").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([planData, profileData]) => {
      setAllEvents((planData.events ?? []) as PlanningEvent[]);

      // Compute annual budget from sum of budget max values
      const br = profileData.budgetRangesJson as Record<
        string,
        { min: number; max: number }
      >;
      if (br) {
        const total = Object.values(br).reduce((sum, r) => sum + (r.max ?? 0), 0);
        setTotalBudget(total);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addToast = useCallback((type: "success" | "warning", text: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const handleStatusChanged = useCallback(
    (eventId: string, newStatus: string, gcalError?: string) => {
      setAllEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, planningStatus: { ...ev.planningStatus, status: newStatus } }
            : ev
        )
      );
      if (gcalError) {
        addToast("warning", `Saved — Calendar sync failed: ${gcalError}`);
      } else if (newStatus === "approved") {
        addToast("success", "Status updated and synced to Google Calendar");
      } else {
        addToast("success", "Status updated");
      }
    },
    [addToast]
  );

  const toggleStatus = (s: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  // Filtered events
  const filteredEvents = allEvents.filter((e) => {
    if (!activeStatuses.has(e.planningStatus.status)) return false;
    if (!showRejected && e.planningStatus.status === "rejected") return false;
    return true;
  });

  const groups = groupByQuarter(filteredEvents);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-500">Loading planning board…</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm ${
              t.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-yellow-50 border border-yellow-200 text-yellow-800"
            }`}
          >
            {t.type === "success" ? (
              <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning Board</h1>
          <p className="mt-1 text-gray-500">
            Manage your event pipeline from candidates to approved sponsorships.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportCSV(filteredEvents)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-colors flex-shrink-0"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Budget bar */}
      {allEvents.length > 0 && (
        <BudgetBar groups={groupByQuarter(allEvents)} totalBudget={totalBudget} />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 font-medium mr-1">Filter:</span>
        {ALL_STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = activeStatuses.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? cfg.badgeClass + " border-transparent"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-4 flex items-center gap-1.5">
          <input
            id="show-rejected"
            type="checkbox"
            checked={showRejected}
            onChange={(e) => setShowRejected(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="show-rejected" className="text-xs text-gray-500 cursor-pointer">
            Show rejected
          </label>
        </div>
      </div>

      {/* Empty state */}
      {allEvents.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No events in your plan yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Browse the{" "}
            <Link href="/events" className="text-indigo-600 hover:underline">
              Event Explorer
            </Link>{" "}
            to add events.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No events match the current filters.
        </div>
      ) : (
        groups.map((g) => (
          <QuarterSection key={g.key} group={g} onStatusChanged={handleStatusChanged} />
        ))
      )}

      {/* Events without a date (no quarter) */}
      {(() => {
        const undated = filteredEvents.filter((e) => !e.startDate);
        if (undated.length === 0) return null;
        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 text-sm">
                No date set
                <span className="ml-2 text-gray-400 font-normal">
                  — {undated.length} event{undated.length !== 1 ? "s" : ""}
                </span>
              </h3>
            </div>
            {undated.map((ev) => (
              <EventRow key={ev.id} event={ev} onStatusChanged={handleStatusChanged} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
