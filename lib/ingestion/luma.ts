// ─── Luma ingestion adapter ───────────────────────────────────────────────────

export interface IngestionSourceResult {
  created: number;
  updated: number;
  errors: string[];
}

interface LumaEventGeo {
  city?: string;
  country?: string;
  full_address?: string;
}

interface LumaEvent {
  api_id?: string;
  name?: string;
  url?: string;
  start_at?: string;
  end_at?: string;
  geo_address_info?: LumaEventGeo;
  geo_latitude?: number;
  geo_longitude?: number;
  description?: string;
  tags?: string[];
  cover_url?: string;
}

interface LumaListResponse {
  entries?: Array<{ event?: LumaEvent }>;
  has_more?: boolean;
  next_cursor?: string;
}

interface LumaSearchResponse {
  events?: Array<{ event?: LumaEvent }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function normalizeUrl(rawUrl: string | undefined, apiId: string | undefined): string | null {
  if (rawUrl && rawUrl.startsWith("http")) return rawUrl;
  if (apiId) return `https://lu.ma/event/${apiId}`;
  return null;
}

function inferRegion(country: string): string {
  const c = country.toLowerCase();
  if (["united states", "us", "usa", "canada", "ca"].some((k) => c.includes(k))) return "north-america";
  if (["united kingdom", "uk", "france", "germany", "spain", "italy", "netherlands", "sweden", "norway",
       "denmark", "finland", "belgium", "switzerland", "austria", "portugal"].some((k) => c.includes(k))) return "europe";
  if (["singapore", "japan", "china", "india", "australia", "south korea", "hong kong"].some((k) => c.includes(k))) return "apac";
  return "global";
}

function mapLumaEvent(ev: LumaEvent): {
  name: string;
  url: string;
  startDate: Date | null;
  endDate: Date | null;
  city: string;
  country: string;
  region: string;
  description: string;
  topicsJson: string[];
  source: string;
} | null {
  const url = normalizeUrl(ev.url, ev.api_id);
  if (!url) return null;
  const name = ev.name?.trim();
  if (!name) return null;

  const city = ev.geo_address_info?.city ?? "unknown";
  const country = ev.geo_address_info?.country ?? "unknown";

  return {
    name,
    url,
    startDate: ev.start_at ? new Date(ev.start_at) : null,
    endDate: ev.end_at ? new Date(ev.end_at) : null,
    city,
    country,
    region: inferRegion(country),
    description: ev.description ?? "",
    topicsJson: ev.tags ?? [],
    source: "luma",
  };
}

// ─── Parse JSON-LD from HTML fallback ────────────────────────────────────────

interface JsonLdEvent {
  "@type"?: string;
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  location?: { name?: string; address?: { addressLocality?: string; addressCountry?: string } | string };
  description?: string;
}

function parseJsonLdEvents(html: string): JsonLdEvent[] {
  const results: JsonLdEvent[] = [];
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  if (!matches) return results;
  for (const match of matches) {
    try {
      const json = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
      const parsed: unknown = JSON.parse(json);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "object" && item !== null && (item as JsonLdEvent)["@type"] === "Event") {
            results.push(item as JsonLdEvent);
          }
        }
      } else if (typeof parsed === "object" && parsed !== null && (parsed as JsonLdEvent)["@type"] === "Event") {
        results.push(parsed as JsonLdEvent);
      }
    } catch {
      // ignore parse errors
    }
  }
  return results;
}

// ─── Upsert event into DB ─────────────────────────────────────────────────────

async function upsertEvent(
  data: NonNullable<ReturnType<typeof mapLumaEvent>>,
  prisma: import("@prisma/client").PrismaClient
): Promise<"created" | "updated"> {
  const existing = await prisma.event.findUnique({ where: { url: data.url } });
  if (existing) {
    await prisma.event.update({
      where: { url: data.url },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        city: data.city,
        country: data.country,
        region: data.region,
        description: data.description,
        topicsJson: data.topicsJson,
        lastRefreshedAt: new Date(),
      },
    });
    return "updated";
  } else {
    await prisma.event.create({
      data: {
        name: data.name,
        url: data.url,
        startDate: data.startDate,
        endDate: data.endDate,
        city: data.city,
        country: data.country,
        region: data.region,
        description: data.description,
        topicsJson: data.topicsJson,
        source: data.source,
      },
    });
    return "created";
  }
}

// ─── Fetch from Luma public API ───────────────────────────────────────────────

async function fetchLumaList(): Promise<LumaEvent[]> {
  const res = await fetch(
    "https://api.lu.ma/public/v1/calendar/list-events?pagination_limit=50",
    { signal: withTimeout(15000), headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Luma list-events HTTP ${res.status}`);
  const data = (await res.json()) as LumaListResponse;
  return (data.entries ?? []).map((e) => e.event ?? {}).filter((e) => !!e.api_id || !!e.url);
}

async function fetchLumaSearch(keyword: string): Promise<LumaEvent[]> {
  const url = `https://api.lu.ma/public/v1/event/search?q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, {
    signal: withTimeout(15000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Luma search HTTP ${res.status}`);
  const data = (await res.json()) as LumaSearchResponse;
  return (data.events ?? []).map((e) => e.event ?? {}).filter((e) => !!e.api_id || !!e.url);
}

// ─── HTML fallback ────────────────────────────────────────────────────────────

async function fetchLumaDiscover(): Promise<LumaEvent[]> {
  const res = await fetch("https://lu.ma/discover", {
    signal: withTimeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlakarEventsBot/1.0)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`Luma discover HTML fetch HTTP ${res.status}`);
  const html = await res.text();

  const jsonLd = parseJsonLdEvents(html);
  return jsonLd.map((ev) => ({
    name: ev.name,
    url: ev.url,
    start_at: ev.startDate,
    end_at: ev.endDate,
    description: ev.description,
    geo_address_info: {
      city:
        typeof ev.location?.address === "object"
          ? ev.location.address?.addressLocality
          : undefined,
      country:
        typeof ev.location?.address === "object"
          ? ev.location.address?.addressCountry
          : undefined,
    },
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runLumaIngestion(
  keywords: string[],
  prisma: import("@prisma/client").PrismaClient
): Promise<IngestionSourceResult> {
  const result: IngestionSourceResult = { created: 0, updated: 0, errors: [] };
  const seen = new Set<string>();

  const processEvents = async (events: LumaEvent[]) => {
    for (const ev of events) {
      const mapped = mapLumaEvent(ev);
      if (!mapped || seen.has(mapped.url)) continue;
      seen.add(mapped.url);
      try {
        const outcome = await upsertEvent(mapped, prisma);
        if (outcome === "created") result.created++;
        else result.updated++;
      } catch (err) {
        result.errors.push(`Failed to upsert ${mapped.url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  // Try list-events API
  try {
    const listEvents = await fetchLumaList();
    await processEvents(listEvents);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Luma list-events failed: ${msg}`);

    // Fallback to HTML scrape
    try {
      const htmlEvents = await fetchLumaDiscover();
      await processEvents(htmlEvents);
    } catch (htmlErr) {
      result.errors.push(
        `Luma discover HTML fallback failed: ${htmlErr instanceof Error ? htmlErr.message : String(htmlErr)}`
      );
    }
  }

  // Keyword searches
  for (const kw of keywords.slice(0, 5)) {
    try {
      const searchEvents = await fetchLumaSearch(kw);
      await processEvents(searchEvents);
    } catch (err) {
      result.errors.push(`Luma search "${kw}" failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
