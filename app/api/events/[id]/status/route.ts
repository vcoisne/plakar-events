import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findCalendarId,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  EventForCalendar,
} from "@/lib/gcal";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { roi: true, planningStatus: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, owner, notes } = body as {
      status?: string;
      owner?: string;
      notes?: string;
    };

    const prevStatus = event.planningStatus?.status ?? null;

    // First upsert the planning status
    const planningStatus = await prisma.planningStatus.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        status: status ?? "candidate",
        owner: owner ?? "",
        notes: notes ?? "",
      },
      update: {
        ...(status !== undefined && { status }),
        ...(owner !== undefined && { owner }),
        ...(notes !== undefined && { notes }),
      },
    });

    // ─── Google Calendar sync ─────────────────────────────────────────────────
    let gcalError: string | null = null;

    if (status !== undefined && status !== prevStatus) {
      const eventForCal: EventForCalendar = {
        id: event.id,
        name: event.name,
        city: event.city,
        country: event.country,
        startDate: event.startDate,
        endDate: event.endDate,
        cplLow: event.roi?.cplLow ?? null,
        cplHigh: event.roi?.cplHigh ?? null,
        roiLabel: event.roi?.roiLabel ?? null,
      };

      if (status === "approved") {
        // Push to Google Calendar
        try {
          const profile = await prisma.companyProfile.findFirst();
          const calName = profile?.calendarName ?? "Plakar Events";
          const calendarId = await findCalendarId(calName);
          if (!calendarId) {
            gcalError = `Calendar "${calName}" not found. Check the calendar name in Company Profile and ensure the service account has access.`;
          } else {
            const existingGcalId = planningStatus.gcalEventId;
            if (existingGcalId) {
              await updateCalendarEvent(calendarId, existingGcalId, eventForCal);
            } else {
              const newGcalId = await createCalendarEvent(calendarId, eventForCal);
              await prisma.planningStatus.update({
                where: { eventId: id },
                data: { gcalEventId: newGcalId },
              });
            }
          }
        } catch (e) {
          gcalError = (e as Error).message;
        }
      } else if (prevStatus === "approved" && status === "rejected") {
        // Remove from Google Calendar
        try {
          const existingGcalId = planningStatus.gcalEventId;
          if (existingGcalId) {
            const profile = await prisma.companyProfile.findFirst();
            const calName = profile?.calendarName ?? "Plakar Events";
            const calendarId = await findCalendarId(calName);
            if (calendarId) {
              await deleteCalendarEvent(calendarId, existingGcalId);
            }
            await prisma.planningStatus.update({
              where: { eventId: id },
              data: { gcalEventId: null },
            });
          }
        } catch (e) {
          gcalError = (e as Error).message;
          // Still clear the gcalEventId even if delete failed
          try {
            await prisma.planningStatus.update({
              where: { eventId: id },
              data: { gcalEventId: null },
            });
          } catch {
            // ignore
          }
        }
      }
      // For candidate/shortlisted: no calendar action
    }

    // Re-fetch updated record to include any gcalEventId changes
    const updated = await prisma.planningStatus.findUnique({ where: { eventId: id } });

    return NextResponse.json({
      ...updated,
      ...(gcalError ? { gcalError } : {}),
    });
  } catch (error) {
    console.error(`POST /api/events/${params.id}/status error:`, error);
    return NextResponse.json(
      { error: "Failed to update planning status" },
      { status: 500 }
    );
  }
}
