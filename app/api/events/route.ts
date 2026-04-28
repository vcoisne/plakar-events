import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const regionParam = searchParams.get("region");
    const typeParam = searchParams.get("type");
    const sourceParam = searchParams.get("source");
    const statusParam = searchParams.get("status");
    const minCpl = searchParams.get("minCpl");
    const maxCpl = searchParams.get("maxCpl");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const sort = searchParams.get("sort") ?? "score_desc";
    const search = searchParams.get("search") ?? "";

    // Build Prisma where clause
    const where: Prisma.EventWhereInput = {};

    if (regionParam) {
      const regions = regionParam.split(",").map((r) => r.trim()).filter(Boolean);
      where.region = { in: regions };
    }

    if (typeParam) {
      const types = typeParam.split(",").map((t) => t.trim()).filter(Boolean);
      where.eventType = { in: types };
    }

    if (sourceParam) {
      const sources = sourceParam.split(",").map((s) => s.trim()).filter(Boolean);
      where.source = { in: sources };
    }

    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      where.planningStatus = { status: { in: statuses } };
    }

    if (startDateParam) {
      where.startDate = { ...(where.startDate as object), gte: new Date(startDateParam) };
    }

    if (endDateParam) {
      where.startDate = { ...(where.startDate as object), lte: new Date(endDateParam) };
    }

    // CPL filter — filter by cplLow/cplHigh overlap
    if (minCpl || maxCpl) {
      const roiFilter: Prisma.EventROIWhereInput = {};
      if (maxCpl) roiFilter.cplLow = { lte: parseFloat(maxCpl) };
      if (minCpl) roiFilter.cplHigh = { gte: parseFloat(minCpl) };
      where.roi = roiFilter;
    }

    // Fuzzy search across name, city, country, topicsJson (as text)
    if (search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { country: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    // Determine sort order
    let orderBy: Prisma.EventOrderByWithRelationInput = {};
    switch (sort) {
      case "date_asc":
        orderBy = { startDate: "asc" };
        break;
      case "cpl_asc":
        orderBy = { roi: { cplLow: "asc" } };
        break;
      case "region_asc":
        orderBy = { region: "asc" };
        break;
      case "score_desc":
      default:
        orderBy = { score: { totalScore: "desc" } };
        break;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy,
      include: {
        score: true,
        roi: true,
        planningStatus: true,
      },
    });

    return NextResponse.json({ events, total: events.length });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
