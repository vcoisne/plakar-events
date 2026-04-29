"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, TrendingUp, Calendar, ClipboardList, DollarSign, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopEvent {
  id: string;
  name: string;
  city: string;
  country: string;
  startDate: string | null;
  eventType: string;
  totalScore: number;
}

interface OpenCfpEvent {
  id: string;
  name: string;
  cfpDeadline: string | null;
  city: string;
  country: string;
  daysUntil: number | null;
}

interface PendingDecision {
  id: string;
  name: string;
  city: string;
  country: string;
  startDate: string | null;
  totalScore: number;
}

interface DashboardData {
  topScoredEvents: TopEvent[];
  openCfpEvents: OpenCfpEvent[];
  pendingDecisions: PendingDecision[];
  budgetSummary: {
    totalApprovedCost: number;
  };
}

interface IngestionSourceResult {
  created: number;
  updated: number;
  errors: string[];
}

interface IngestionLog {
  timestamp: string;
  created: number;
  updated: number;
  lumaErrors: string[];
  webErrors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
}

const LAST_SYNC_KEY = "plakar_last_sync";
const INGESTION_LOG_KEY = "plakar_ingestion_log";

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm ${
        type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {type === "error" && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-75 hover:opacity-100 text-lg leading-none">
        ×
      </button>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ingestion state
  const [discovering, setDiscovering] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [ingestionLog, setIngestionLog] = useState<IngestionLog | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
    // Load persisted sync info
    const storedSync = localStorage.getItem(LAST_SYNC_KEY);
    if (storedSync) setLastSync(storedSync);
    const storedLog = localStorage.getItem(INGESTION_LOG_KEY);
    if (storedLog) {
      try {
        setIngestionLog(JSON.parse(storedLog) as IngestionLog);
      } catch {
        // ignore
      }
    }
  }, [loadDashboard]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: ["luma", "web"] }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as {
        lumaResult: IngestionSourceResult;
        webResult: IngestionSourceResult;
        totalCreated: number;
        totalUpdated: number;
        duration: number;
      };

      const now = new Date().toISOString();
      const log: IngestionLog = {
        timestamp: now,
        created: result.totalCreated,
        updated: result.totalUpdated,
        lumaErrors: result.lumaResult.errors,
        webErrors: result.webResult.errors,
      };

      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.setItem(INGESTION_LOG_KEY, JSON.stringify(log));
      setLastSync(now);
      setIngestionLog(log);

      setToast({
        message: `Found ${result.totalCreated} new event${result.totalCreated !== 1 ? "s" : ""}, updated ${result.totalUpdated}`,
        type: "success",
      });

      // Refresh dashboard data
      loadDashboard();
    } catch (err) {
      setToast({
        message: `Discovery failed: ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-500">Loading dashboard…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error ?? "Failed to load dashboard"}</p>
          </div>
        </div>
      </div>
    );
  }

  const topCount = data.topScoredEvents.length;
  const cfpCount = data.openCfpEvents.length;
  const pendingCount = data.pendingDecisions.length;
  const budget = data.budgetSummary.totalApprovedCost;

  return (
    <div className="p-6 md:p-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="max-w-5xl mx-auto">
        {/* ── Header with Discover button ── */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-gray-500">Your conference intelligence overview.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {discovering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Discovering…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Discover Events
                </>
              )}
            </button>
            {lastSync && (
              <p className="text-xs text-gray-400">
                Last synced: {new Date(lastSync).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
            label="Top Scored Events"
            value={topCount > 0 ? String(topCount) : "—"}
            sub="by fit score"
          />
          <StatCard
            icon={<Calendar className="h-5 w-5 text-teal-600" />}
            label="Open CFPs"
            value={cfpCount > 0 ? String(cfpCount) : "—"}
            sub="deadlines upcoming"
            valueColor="text-teal-700"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5 text-amber-600" />}
            label="Pending Decisions"
            value={pendingCount > 0 ? String(pendingCount) : "—"}
            sub="candidates ≥60 score"
            valueColor="text-amber-700"
          />
          <StatCard
            icon={<DollarSign className="h-5 w-5 text-green-600" />}
            label="Approved Budget"
            value={budget > 0 ? formatMoney(budget) : "—"}
            sub="estimated cost"
            valueColor="text-green-700"
          />
        </div>

        {/* ── Action needed: Open CFPs ── */}
        {data.openCfpEvents.length > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-teal-700" />
              <h2 className="font-semibold text-teal-900">Action needed — Open CFPs</h2>
            </div>
            <div className="space-y-2">
              {data.openCfpEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between bg-white border border-teal-100 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.name}</p>
                    <p className="text-xs text-gray-400">
                      {ev.city}, {ev.country} · Deadline: {formatDate(ev.cfpDeadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {ev.daysUntil !== null && (
                      <span className="text-xs font-medium text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                        {ev.daysUntil}d left
                      </span>
                    )}
                    <a
                      href={`/events/${ev.id}`}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Two-column lower section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top scored events */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Top Scored Events
            </h2>
            {data.topScoredEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No scored events yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topScoredEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <a href={`/events/${ev.id}`} className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate block">
                          {ev.name}
                        </a>
                        <p className="text-xs text-gray-400 truncate">
                          {ev.city}, {ev.country} · {formatDate(ev.startDate)}
                        </p>
                      </div>
                    </div>
                    <span className={`ml-3 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${scoreBg(ev.totalScore)}`}>
                      {Math.round(ev.totalScore)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending decisions */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              Pending Decisions
            </h2>
            {data.pendingDecisions.length === 0 ? (
              <p className="text-sm text-gray-400">No events waiting for a decision.</p>
            ) : (
              <div className="space-y-2">
                {data.pendingDecisions.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <a href={`/events/${ev.id}`} className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate block">
                        {ev.name}
                      </a>
                      <p className="text-xs text-gray-400 truncate">
                        {ev.city}, {ev.country} · {formatDate(ev.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-xs font-bold ${scoreColor(ev.totalScore)}`}>
                        {Math.round(ev.totalScore)}/100
                      </span>
                      <a href={`/events/${ev.id}`} className="text-xs text-indigo-600 hover:underline font-medium">
                        View →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Ingestion log ── */}
        {ingestionLog && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gray-400" />
              Last Ingestion Log
              <span className="font-normal text-gray-400">
                · {new Date(ingestionLog.timestamp).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>
            </h2>
            <div className="flex gap-4 flex-wrap text-sm mb-3">
              <span className="text-green-700 font-medium">
                +{ingestionLog.created} created
              </span>
              <span className="text-blue-700 font-medium">
                {ingestionLog.updated} updated
              </span>
              {(ingestionLog.lumaErrors.length + ingestionLog.webErrors.length) > 0 && (
                <span className="text-amber-600 font-medium">
                  {ingestionLog.lumaErrors.length + ingestionLog.webErrors.length} warnings
                </span>
              )}
            </div>
            {(ingestionLog.lumaErrors.length > 0 || ingestionLog.webErrors.length > 0) && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Show warnings ({ingestionLog.lumaErrors.length + ingestionLog.webErrors.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {ingestionLog.lumaErrors.map((e, i) => (
                    <li key={`luma-${i}`} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      [Luma] {e}
                    </li>
                  ))}
                  {ingestionLog.webErrors.map((e, i) => (
                    <li key={`web-${i}`} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      [Web] {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  valueColor = "text-gray-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
