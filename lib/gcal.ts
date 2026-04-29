/**
 * Google Calendar REST API integration using service account auth.
 * Uses raw fetch + Node.js crypto — no googleapis npm package.
 */

import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventForCalendar {
  id: string;
  name: string;
  city: string;
  country: string;
  startDate: Date | null;
  endDate: Date | null;
  cplLow?: number | null;
  cplHigh?: number | null;
  roiLabel?: string | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  calendarName: string | null;
  error: string | null;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_CALENDAR_CREDENTIALS;
  if (!raw) {
    throw new Error(
      "GOOGLE_CALENDAR_CREDENTIALS environment variable is not set. " +
        "Set it to the JSON contents of your service account key file."
    );
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccountKey;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key in credentials JSON.");
    }
    return parsed;
  } catch (e) {
    throw new Error(
      `Failed to parse GOOGLE_CALENDAR_CREDENTIALS: ${(e as Error).message}`
    );
  }
}

function base64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJWT(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const sig = base64url(sign.sign(key.private_key));
  return `${signingInput}.${sig}`;
}

async function getAccessToken(): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  // Return cached token if it has > 5 min remaining
  if (cachedToken && tokenExpiresAt - nowSec > 300) {
    return cachedToken;
  }

  const key = getServiceAccountKey();
  const jwt = makeJWT(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiresAt = Math.floor(Date.now() / 1000) + json.expires_in;
  return cachedToken;
}

function formatDate(d: Date): string {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function nextDay(d: Date): string {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function buildEventBody(event: EventForCalendar): object {
  const cplStr =
    event.cplLow != null && event.cplHigh != null
      ? `CPL estimate: $${event.cplLow.toFixed(0)}–$${event.cplHigh.toFixed(0)}`
      : "";
  const roiStr = event.roiLabel ? `ROI: ${event.roiLabel}` : "";
  const link = `http://localhost:3000/events/${event.id}`;
  const descParts = [
    `Event: ${event.name}`,
    event.startDate
      ? `Dates: ${formatDate(event.startDate)}${event.endDate ? ` → ${formatDate(event.endDate)}` : ""}`
      : "",
    `Location: ${event.city}, ${event.country}`,
    cplStr,
    roiStr,
    `Details: ${link}`,
  ].filter(Boolean);

  const startDate = event.startDate ? formatDate(event.startDate) : formatDate(new Date());
  const endDate = event.endDate ? nextDay(event.endDate) : nextDay(new Date());

  return {
    summary: event.name,
    location: `${event.city}, ${event.country}`,
    description: descParts.join("\n"),
    start: { date: startDate },
    end: { date: endDate },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find a calendar ID by name from the service account's calendar list.
 */
export async function findCalendarId(calendarName: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list calendars (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { items?: Array<{ id: string; summary: string }> };
  const cal = (data.items ?? []).find(
    (c) => c.summary.toLowerCase() === calendarName.toLowerCase()
  );
  return cal?.id ?? null;
}

/**
 * Create a calendar event; returns the Google event ID.
 */
export async function createCalendarEvent(
  calendarId: string,
  event: EventForCalendar
): Promise<string> {
  const token = await getAccessToken();
  const body = buildEventBody(event);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create calendar event (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Update an existing calendar event.
 */
export async function updateCalendarEvent(
  calendarId: string,
  gcalEventId: string,
  event: EventForCalendar
): Promise<void> {
  const token = await getAccessToken();
  const body = buildEventBody(event);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gcalEventId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update calendar event (${res.status}): ${text}`);
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(
  calendarId: string,
  gcalEventId: string
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(gcalEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  // 204 = success, 410 = already deleted — both are acceptable
  if (!res.ok && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Failed to delete calendar event (${res.status}): ${text}`);
  }
}

/**
 * Test the Google Calendar connection.
 * Returns { ok, calendarName, error }.
 */
export async function testConnection(calendarName: string): Promise<ConnectionTestResult> {
  try {
    const calendarId = await findCalendarId(calendarName);
    if (calendarId) {
      return { ok: true, calendarName, error: null };
    } else {
      return {
        ok: false,
        calendarName: null,
        error: `Calendar "${calendarName}" not found. Make sure the service account has been shared this calendar.`,
      };
    }
  } catch (e) {
    return { ok: false, calendarName: null, error: (e as Error).message };
  }
}
