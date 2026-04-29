// ─── Web ingestion adapter (Eventbrite + Confs.tech) ─────────────────────────

import { IngestionSourceResult } from "./luma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NormalizedEvent {
  name: string;
  url: string;
  startDate: Date | null;
  endDate: Date | null;
  city: string;
  country: string;
  region: string;
  description: string;
  topicsJson: string[];
  organizer: string;
  source: "web";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferRegion(country: string): string {
  const c = country.toLowerCase();
  if (["united states", "us", "usa", "canada"].some((k) => c.includes(k))) return "north-america";
  if (["united kingdom", "uk", "france", "germany", "spain", "italy", "netherlands", "sweden",
       "norway", "denmark", "finland", "belgium", "switzerland", "austria", "portugal",
       "ireland", "poland", "czech"].some((k) => c.includes(k))) return "europe";
  if (["singapore", "japan", "china", "india", "australia", "south korea", "hong kong",
       "new zealand", "taiwan"].some((k) => c.includes(k))) return "apac";
  return "global";
}

// ─── JSON-LD parser ───────────────────────────────────────────────────────────

interface JsonLdEvent {
  "@type"?: string;
  "@context"?: string;
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: {
    name?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
      streetAddress?: string;
    } | string;
  };
  organizer?: { name?: string } | string;
  eventAttendanceMode?: string;
  offers?: unknown;
}

function parseJsonLdEvents(html: string): JsonLdEvent[] {
  const results: JsonLdEvent[] = [];
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  if (!matches) return results;
  for (const match of matches) {
    try {
      const json = match
        .replace(/<script[^>]*>/i, "")
        .replace(/<\/script>/i, "")
        .trim();
      const parsed: unknown = JSON.parse(json);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (typeof item === "object" && item !== null) {
          const ev = item as JsonLdEvent;
          if (ev["@type"] === "Event") results.push(ev);
        }
      }
    } catch {
      // skip malformed blocks
    }
  }
  return results;
}

function jsonLdToNormalized(ev: JsonLdEvent, sourceUrl: string): NormalizedEvent | null {
  if (!ev.name) return null;
  const url = ev.url ?? sourceUrl;
  if (!url || !url.startsWith("http")) return null;

  const addrObj =
    typeof ev.location?.address === "object" ? ev.location.address : null;
  const city = addrObj?.addressLocality ?? "unknown";
  const country = addrObj?.addressCountry ?? "unknown";

  const organizer =
    typeof ev.organizer === "string"
      ? ev.organizer
      : ev.organizer?.name ?? "unknown";

  return {
    name: ev.name.trim(),
    url: url.split("?")[0], // strip query params
    startDate: ev.startDate ? new Date(ev.startDate) : null,
    endDate: ev.endDate ? new Date(ev.endDate) : null,
    city,
    country,
    region: inferRegion(country),
    description: ev.description ?? "",
    topicsJson: [],
    organizer,
    source: "web",
  };
}

// ─── Fuzzy deduplication helper ───────────────────────────────────────────────

function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const intersection = Array.from(wordsA).filter((w) => wordsB.has(w)).length;
  const wordsAArr = Array.from(wordsA);
  const wordsBArr = Array.from(wordsB);
  const union = new Set(wordsAArr.concat(wordsBArr)).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Upsert with fuzzy dedup ──────────────────────────────────────────────────

async function upsertEvent(
  data: NormalizedEvent,
  prisma: import("@prisma/client").PrismaClient
): Promise<"created" | "updated"> {
  // Exact URL match
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
        organizer: data.organizer,
        lastRefreshedAt: new Date(),
      },
    });
    return "updated";
  }

  // Fuzzy: check events in same month/year
  if (data.startDate) {
    const monthStart = new Date(data.startDate.getFullYear(), data.startDate.getMonth(), 1);
    const monthEnd = new Date(data.startDate.getFullYear(), data.startDate.getMonth() + 1, 0);
    const sameMonthEvents = await prisma.event.findMany({
      where: { startDate: { gte: monthStart, lte: monthEnd } },
      select: { id: true, url: true, name: true },
    });
    for (const ev of sameMonthEvents) {
      if (nameSimilarity(data.name, ev.name) > 0.8) {
        await prisma.event.update({
          where: { url: ev.url },
          data: {
            name: data.name,
            startDate: data.startDate,
            endDate: data.endDate,
            city: data.city,
            country: data.country,
            region: data.region,
            description: data.description,
            topicsJson: data.topicsJson,
            organizer: data.organizer,
            lastRefreshedAt: new Date(),
          },
        });
        return "updated";
      }
    }
  }

  // Create new
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
      organizer: data.organizer,
      source: data.source,
    },
  });
  return "created";
}

// ─── Eventbrite ingestion ─────────────────────────────────────────────────────

const EVENTBRITE_URLS = [
  "https://www.eventbrite.com/d/online/tech-conference/",
  "https://www.eventbrite.com/d/europe/tech-conference/",
  "https://www.eventbrite.com/d/united-states/tech-conference/",
  "https://www.eventbrite.com/d/online/developer-conference/",
];

async function fetchEventbriteCategory(url: string): Promise<NormalizedEvent[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlakarEventsBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Eventbrite HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const jsonLd = parseJsonLdEvents(html);
  return jsonLd
    .map((ev) => jsonLdToNormalized(ev, url))
    .filter((ev): ev is NormalizedEvent => ev !== null);
}

async function runEventbriteIngestion(
  prisma: import("@prisma/client").PrismaClient,
  result: IngestionSourceResult,
  seen: Set<string>
): Promise<void> {
  for (const url of EVENTBRITE_URLS) {
    try {
      const events = await fetchEventbriteCategory(url);
      for (const ev of events) {
        if (seen.has(ev.url)) continue;
        seen.add(ev.url);
        try {
          const outcome = await upsertEvent(ev, prisma);
          if (outcome === "created") result.created++;
          else result.updated++;
        } catch (err) {
          result.errors.push(
            `Eventbrite upsert ${ev.url}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      result.errors.push(
        `Eventbrite fetch ${url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ─── Confs.tech (GitHub JSON data) ingestion ─────────────────────────────────

interface ConftechEvent {
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  city?: string;
  country?: string;
  cfpEndDate?: string;
  twitter?: string;
  topics?: string[];
}

const CONFTECH_TOPICS = ["javascript", "devops", "general", "security", "data", "golang", "python"];
const CURRENT_YEAR = new Date().getFullYear();

async function fetchConftechTopic(topic: string, year: number): Promise<ConftechEvent[]> {
  const url = `https://raw.githubusercontent.com/tech-conferences/conference-data/master/conferences/${year}/${topic}.json`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Confs.tech HTTP ${res.status} for ${topic}/${year}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data as ConftechEvent[];
}

function conftechToNormalized(ev: ConftechEvent, topic: string): NormalizedEvent | null {
  if (!ev.name || !ev.url) return null;
  const url = ev.url.startsWith("http") ? ev.url : `https://${ev.url}`;
  const country = ev.country ?? "unknown";
  return {
    name: ev.name.trim(),
    url: url.split("?")[0],
    startDate: ev.startDate ? new Date(ev.startDate) : null,
    endDate: ev.endDate ? new Date(ev.endDate) : null,
    city: ev.city ?? "unknown",
    country,
    region: inferRegion(country),
    description: "",
    topicsJson: ev.topics ?? [topic],
    organizer: "unknown",
    source: "web",
  };
}

async function runConftechIngestion(
  prisma: import("@prisma/client").PrismaClient,
  result: IngestionSourceResult,
  seen: Set<string>
): Promise<void> {
  for (const topic of CONFTECH_TOPICS) {
    for (const year of [CURRENT_YEAR, CURRENT_YEAR + 1]) {
      try {
        const events = await fetchConftechTopic(topic, year);
        for (const ev of events) {
          const mapped = conftechToNormalized(ev, topic);
          if (!mapped || seen.has(mapped.url)) continue;
          seen.add(mapped.url);
          try {
            const outcome = await upsertEvent(mapped, prisma);
            if (outcome === "created") result.created++;
            else result.updated++;
          } catch (err) {
            result.errors.push(
              `Confs.tech upsert ${mapped.url}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      } catch (err) {
        result.errors.push(
          `Confs.tech fetch ${topic}/${year}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runWebIngestion(
  prisma: import("@prisma/client").PrismaClient
): Promise<IngestionSourceResult> {
  const result: IngestionSourceResult = { created: 0, updated: 0, errors: [] };
  const seen = new Set<string>();

  await runEventbriteIngestion(prisma, result, seen);
  await runConftechIngestion(prisma, result, seen);

  return result;
}
