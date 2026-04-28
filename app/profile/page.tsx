"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, X, Check, Loader2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NameDescription {
  name: string;
  description: string;
}

interface CplTargets {
  conference: number;
  meetup: number;
  analyst: number;
}

interface TierRange {
  min: number;
  max: number;
}

interface BudgetRanges {
  Platinum: TierRange;
  Gold: TierRange;
  Silver: TierRange;
  Community: TierRange;
}

interface LeadEstimates {
  conference: number;
  meetup: number;
  analyst: number;
  community: number;
}

interface OverheadPerEvent {
  conference: number;
  meetup: number;
  analyst: number;
  community: number;
}

interface ProfileData {
  companyName: string;
  description: string;
  productsJson: NameDescription[];
  personasJson: NameDescription[];
  messagingJson: string[];
  positioningText: string;
  regionsJson: string[];
  competitorsJson: string[];
  cplTargetsJson: CplTargets;
  budgetRangesJson: BudgetRanges;
  leadEstimatesJson: LeadEstimates;
  avgDealValue: number;
  leadToOppRate: number;
  overheadPerEventJson: OverheadPerEvent;
  calendarName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PREDEFINED_REGIONS = [
  "North America",
  "Europe",
  "APAC",
  "MENA",
  "Latin America",
  "Global",
];

const DEFAULT_PROFILE: ProfileData = {
  companyName: "",
  description: "",
  productsJson: [],
  personasJson: [],
  messagingJson: [],
  positioningText: "",
  regionsJson: [],
  competitorsJson: [],
  cplTargetsJson: { conference: 0, meetup: 0, analyst: 0 },
  budgetRangesJson: {
    Platinum: { min: 0, max: 0 },
    Gold: { min: 0, max: 0 },
    Silver: { min: 0, max: 0 },
    Community: { min: 0, max: 0 },
  },
  leadEstimatesJson: { conference: 0, meetup: 0, analyst: 0, community: 0 },
  avgDealValue: 0,
  leadToOppRate: 0,
  overheadPerEventJson: { conference: 0, meetup: 0, analyst: 0, community: 0 },
  calendarName: "Plakar Events",
};

// ─── Helper components ────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 ml-4" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-4" />
        )}
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function InputError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value || ""}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full pr-8 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errors, setErrors] = useState<{ companyName?: string; description?: string }>({});
  const [competitorInput, setCompetitorInput] = useState("");
  const [regionInput, setRegionInput] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profile on mount
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          companyName: data.companyName ?? "",
          description: data.description ?? "",
          productsJson: Array.isArray(data.productsJson) ? data.productsJson : [],
          personasJson: Array.isArray(data.personasJson) ? data.personasJson : [],
          messagingJson: Array.isArray(data.messagingJson) ? data.messagingJson : [],
          positioningText: data.positioningText ?? "",
          regionsJson: Array.isArray(data.regionsJson) ? data.regionsJson : [],
          competitorsJson: Array.isArray(data.competitorsJson) ? data.competitorsJson : [],
          cplTargetsJson: data.cplTargetsJson ?? { conference: 0, meetup: 0, analyst: 0 },
          budgetRangesJson: data.budgetRangesJson ?? DEFAULT_PROFILE.budgetRangesJson,
          leadEstimatesJson: data.leadEstimatesJson ?? DEFAULT_PROFILE.leadEstimatesJson,
          avgDealValue: data.avgDealValue ?? 0,
          leadToOppRate: data.leadToOppRate ?? 0,
          overheadPerEventJson: data.overheadPerEventJson ?? DEFAULT_PROFILE.overheadPerEventJson,
          calendarName: data.calendarName ?? "Plakar Events",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Validate and save
  const save = useCallback(async (data: ProfileData) => {
    const errs: typeof errors = {};
    if (!data.companyName.trim()) errs.companyName = "Company name is required";
    if (!data.description.trim()) errs.description = "Description is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // Debounced auto-save on blur: we use a manual "Save changes" button instead
  // to avoid partial saves while typing. The button approach is cleaner here.

  const handleSave = () => save(profile);

  const update = (patch: Partial<ProfileData>) =>
    setProfile((prev) => ({ ...prev, ...patch }));

  // ── Dynamic list helpers ───────────────────────────────────────────────────

  function updateNameDescList(
    key: "productsJson" | "personasJson",
    index: number,
    field: "name" | "description",
    value: string
  ) {
    const list = [...(profile[key] as NameDescription[])];
    list[index] = { ...list[index], [field]: value };
    update({ [key]: list });
  }

  function addNameDescItem(key: "productsJson" | "personasJson") {
    update({ [key]: [...(profile[key] as NameDescription[]), { name: "", description: "" }] });
  }

  function removeNameDescItem(key: "productsJson" | "personasJson", index: number) {
    update({ [key]: (profile[key] as NameDescription[]).filter((_, i) => i !== index) });
  }

  function updateMessaging(index: number, value: string) {
    const list = [...profile.messagingJson];
    list[index] = value;
    update({ messagingJson: list });
  }

  function addMessaging() {
    update({ messagingJson: [...profile.messagingJson, ""] });
  }

  function removeMessaging(index: number) {
    update({ messagingJson: profile.messagingJson.filter((_, i) => i !== index) });
  }

  function toggleRegion(region: string) {
    const current = profile.regionsJson;
    if (current.includes(region)) {
      update({ regionsJson: current.filter((r) => r !== region) });
    } else {
      update({ regionsJson: [...current, region] });
    }
  }

  function addCustomRegion() {
    const val = regionInput.trim();
    if (val && !profile.regionsJson.includes(val)) {
      update({ regionsJson: [...profile.regionsJson, val] });
    }
    setRegionInput("");
  }

  function removeRegion(region: string) {
    update({ regionsJson: profile.regionsJson.filter((r) => r !== region) });
  }

  function addCompetitor() {
    const vals = competitorInput
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v && !profile.competitorsJson.includes(v));
    if (vals.length > 0) {
      update({ competitorsJson: [...profile.competitorsJson, ...vals] });
    }
    setCompetitorInput("");
  }

  function removeCompetitor(c: string) {
    update({ competitorsJson: profile.competitorsJson.filter((x) => x !== c) });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-500">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
            <p className="mt-1 text-gray-500">
              Configure Plakar&apos;s profile to power AI scoring, ROI estimation, and strategy
              generation. Changes invalidate existing event scores.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Error saving
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Save changes
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {/* ── Section 1: Company Basics ── */}
          <Section
            title="Company Basics"
            description="Name, description, and positioning statement."
          >
            <div className="space-y-4 pt-4">
              <div>
                <Label required>Company name</Label>
                <input
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  placeholder="e.g. Plakar"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <InputError message={errors.companyName} />
              </div>

              <div>
                <Label required>Description</Label>
                <textarea
                  rows={4}
                  value={profile.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What does your company do?"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <InputError message={errors.description} />
              </div>

              <div>
                <Label>Positioning text</Label>
                <p className="text-xs text-gray-400 mb-1">2–3 sentences that define your market position.</p>
                <textarea
                  rows={4}
                  value={profile.positioningText}
                  onChange={(e) => update({ positioningText: e.target.value })}
                  placeholder="How you differentiate from alternatives…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </Section>

          {/* ── Section 2: Products & Personas ── */}
          <Section
            title="Products & Personas"
            description="Define your products and target buyer personas."
          >
            <div className="space-y-6 pt-4">
              {/* Products */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Products</Label>
                  <button
                    type="button"
                    onClick={() => addNameDescItem("productsJson")}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add product
                  </button>
                </div>
                <div className="space-y-3">
                  {profile.productsJson.map((p, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updateNameDescList("productsJson", i, "name", e.target.value)}
                            placeholder="Product name"
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <textarea
                            rows={2}
                            value={p.description}
                            onChange={(e) => updateNameDescList("productsJson", i, "description", e.target.value)}
                            placeholder="Brief description…"
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNameDescItem("productsJson", i)}
                          className="text-gray-400 hover:text-red-500 mt-1 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {profile.productsJson.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No products added yet.</p>
                  )}
                </div>
              </div>

              {/* Personas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Target personas</Label>
                  <button
                    type="button"
                    onClick={() => addNameDescItem("personasJson")}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add persona
                  </button>
                </div>
                <div className="space-y-3">
                  {profile.personasJson.map((p, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updateNameDescList("personasJson", i, "name", e.target.value)}
                            placeholder="Persona name (e.g. DevOps Engineer)"
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <textarea
                            rows={2}
                            value={p.description}
                            onChange={(e) => updateNameDescList("personasJson", i, "description", e.target.value)}
                            placeholder="What they care about, pain points, and value they get…"
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNameDescItem("personasJson", i)}
                          className="text-gray-400 hover:text-red-500 mt-1 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {profile.personasJson.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No personas added yet.</p>
                  )}
                </div>
              </div>

              {/* Key Messaging */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Key messaging</Label>
                  <button
                    type="button"
                    onClick={addMessaging}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add message
                  </button>
                </div>
                <div className="space-y-2">
                  {profile.messagingJson.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={msg}
                        onChange={(e) => updateMessaging(i, e.target.value)}
                        placeholder="Key talking point or differentiator…"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeMessaging(i)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {profile.messagingJson.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No key messages added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 3: Strategic Focus ── */}
          <Section
            title="Strategic Focus"
            description="Target regions, competitors, and strategic priorities."
          >
            <div className="space-y-5 pt-4">
              {/* Regions */}
              <div>
                <Label>Target regions</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PREDEFINED_REGIONS.map((region) => {
                    const selected = profile.regionsJson.includes(region);
                    return (
                      <button
                        key={region}
                        type="button"
                        onClick={() => toggleRegion(region)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {region}
                      </button>
                    );
                  })}
                </div>
                {/* Custom region tags */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {profile.regionsJson
                    .filter((r) => !PREDEFINED_REGIONS.includes(r))
                    .map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white"
                      >
                        {r}
                        <button type="button" onClick={() => removeRegion(r)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={regionInput}
                    onChange={(e) => setRegionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCustomRegion(); }
                    }}
                    placeholder="Add custom region…"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomRegion}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Competitors */}
              <div>
                <Label>Competitors</Label>
                <p className="text-xs text-gray-400 mb-2">Enter names separated by commas, then press Add.</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCompetitor(); }
                    }}
                    placeholder="e.g. Veeam, Rubrik, Cohesity"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addCompetitor}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.competitorsJson.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                    >
                      {c}
                      <button type="button" onClick={() => removeCompetitor(c)}>
                        <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                  {profile.competitorsJson.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No competitors added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 4: CPL Targets ── */}
          <Section
            title="CPL Targets by Event Type"
            description="Target cost-per-lead for each event category."
          >
            <div className="grid grid-cols-3 gap-4 pt-4">
              {(["conference", "meetup", "analyst"] as const).map((type) => (
                <div key={type}>
                  <Label>{type.charAt(0).toUpperCase() + type.slice(1)} CPL</Label>
                  <MoneyInput
                    value={profile.cplTargetsJson[type]}
                    onChange={(v) =>
                      update({
                        cplTargetsJson: { ...profile.cplTargetsJson, [type]: v },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Section 5: Budget Ranges ── */}
          <Section
            title="Budget Ranges by Sponsorship Tier"
            description="Min and max budget for each sponsorship tier."
          >
            <div className="pt-4">
              <div className="grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 mb-2 px-1">
                <div className="col-span-1">Tier</div>
                <div className="col-span-2">Min ($)</div>
                <div className="col-span-2">Max ($)</div>
              </div>
              {(["Platinum", "Gold", "Silver", "Community"] as const).map((tier) => (
                <div key={tier} className="grid grid-cols-5 gap-2 mb-2 items-center">
                  <div className="col-span-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        tier === "Platinum"
                          ? "bg-slate-100 text-slate-700"
                          : tier === "Gold"
                          ? "bg-yellow-100 text-yellow-700"
                          : tier === "Silver"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {tier}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <MoneyInput
                      value={profile.budgetRangesJson[tier].min}
                      onChange={(v) =>
                        update({
                          budgetRangesJson: {
                            ...profile.budgetRangesJson,
                            [tier]: { ...profile.budgetRangesJson[tier], min: v },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <MoneyInput
                      value={profile.budgetRangesJson[tier].max}
                      onChange={(v) =>
                        update({
                          budgetRangesJson: {
                            ...profile.budgetRangesJson,
                            [tier]: { ...profile.budgetRangesJson[tier], max: v },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Section 6: Lead & ROI Defaults ── */}
          <Section
            title="Lead & ROI Defaults"
            description="Default lead estimates, deal value, conversion rate, and overhead per event type."
          >
            <div className="space-y-5 pt-4">
              {/* Default leads by event type */}
              <div>
                <Label>Default leads by event type</Label>
                <div className="grid grid-cols-4 gap-3 mt-1">
                  {(["conference", "meetup", "analyst", "community"] as const).map((type) => (
                    <div key={type}>
                      <p className="text-xs text-gray-500 mb-1 capitalize">{type}</p>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={profile.leadEstimatesJson[type] || ""}
                        placeholder="0"
                        onChange={(e) =>
                          update({
                            leadEstimatesJson: {
                              ...profile.leadEstimatesJson,
                              [type]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Avg deal value & lead-to-opp */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Average deal value</Label>
                  <MoneyInput
                    value={profile.avgDealValue}
                    onChange={(v) => update({ avgDealValue: v })}
                  />
                </div>
                <div>
                  <Label>Lead-to-opportunity rate</Label>
                  <PercentInput
                    value={profile.leadToOppRate}
                    onChange={(v) => update({ leadToOppRate: v })}
                  />
                </div>
              </div>

              {/* Overhead per event type */}
              <div>
                <Label>Overhead per event type</Label>
                <p className="text-xs text-gray-400 mb-2">
                  Estimated internal costs (travel, staff time, materials) per event type.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {(["conference", "meetup", "analyst", "community"] as const).map((type) => (
                    <div key={type}>
                      <p className="text-xs text-gray-500 mb-1 capitalize">{type}</p>
                      <MoneyInput
                        value={profile.overheadPerEventJson[type]}
                        onChange={(v) =>
                          update({
                            overheadPerEventJson: {
                              ...profile.overheadPerEventJson,
                              [type]: v,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 7: Google Calendar ── */}
          <Section
            title="Google Calendar"
            description="Calendar integration settings."
          >
            <div className="pt-4">
              <Label>Calendar name</Label>
              <input
                type="text"
                value={profile.calendarName}
                onChange={(e) => update({ calendarName: e.target.value })}
                placeholder="Plakar Events"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                This must be the exact name of an existing Google Calendar in the connected
                account. Events will be created in this calendar when approved in the planning
                board.
              </p>
            </div>
          </Section>
        </div>

        {/* Sticky bottom save bar */}
        <div className="mt-8 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">
            Saving will mark all existing event scores as stale and re-queue them.
          </p>
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Error saving
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
