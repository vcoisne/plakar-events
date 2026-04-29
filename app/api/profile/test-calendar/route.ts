import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testConnection } from "@/lib/gcal";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const profile = await prisma.companyProfile.findFirst();
    const calendarName = profile?.calendarName ?? "Plakar Events";

    const result = await testConnection(calendarName);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        calendarName: null,
        error: (error as Error).message,
      },
      { status: 200 } // Always 200 — the error is conveyed in the response body
    );
  }
}
