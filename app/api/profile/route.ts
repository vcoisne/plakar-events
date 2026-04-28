import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default seed data derived from Plakar's product-marketing-context and ICP documents
const DEFAULT_PROFILE = {
  companyName: "Plakar",
  description:
    "Plakar is the open-source standard for unified resilience — backup anything, store anywhere, with zero-trust encryption and no vendor lock-in. Plakar decouples data protection from infrastructure, performing client-side deduplication and encryption at the source before data moves, then storing encrypted snapshots (Klosets) on any backend.",
  productsJson: [
    {
      name: "Plakar (Open Source)",
      description:
        "The core open-source backup engine. CLI-native, plugin-based, with client-side deduplication and encryption. Stores encrypted Kloset snapshots on any storage backend (local, S3, SFTP, cloud). Supports filesystems, databases, Kubernetes, and SaaS via connectors.",
    },
    {
      name: "Plakar Enterprise",
      description:
        "Commercial control plane adding unified backup posture management (single pane of glass across on-prem, cloud, and SaaS), role-based access control, compliance workflows, and the Plakar Vault Protocol for MSP delegation — all without requiring key custody.",
    },
    {
      name: "Plakar Vault Protocol",
      description:
        "A standardized storage protocol that enables MSPs and cloud providers to manage retention, replication, and storage tiering for customers without ever accessing encryption keys. Enables a zero-knowledge Resilience-as-a-Service model.",
    },
  ],
  personasJson: [
    {
      name: "DevOps / Platform Engineer",
      description:
        "Reliability-focused, automation-first, CLI-native. Needs backup tooling that integrates into existing pipelines without operational overhead. Pain: brittle scripts, storage cost explosion, backup tools that don't fit modern infra. Values open-source, petabyte-scale performance, and plugin architecture.",
    },
    {
      name: "SRE / Infrastructure Lead",
      description:
        "Owns RTO/RPO and restore SLAs. Needs cryptographic proof that backups work before disaster strikes. Pain: no integrity verification, slow single-file restores requiring full VM restore. Values instant mount/browse, cryptographic integrity proofs, and immutable snapshots.",
    },
    {
      name: "CISO / Security Lead",
      description:
        "Zero-trust and key custody are non-negotiable. Needs auditable, open-source cryptography and ransomware detection. Pain: legacy tools decrypt at gateway, exposing keys; black-box proprietary formats. Values client-side encryption, zero-knowledge storage, and entropy analysis.",
    },
    {
      name: "IT Director / CTO",
      description:
        "Cost control, vendor independence, compliance readiness. Needs unified visibility across the entire data estate. Pain: storage cost bloat, fragmented coverage reports, vendor lock-in. Values 90%+ cost reduction, unified posture dashboard, and open PTAR/Kloset formats.",
    },
    {
      name: "MSP Operator",
      description:
        "Manages backup for multiple client organizations at scale. Needs clean delegation without touching client keys. Pain: can't efficiently manage backup across clients without becoming a data custodian. Values the Plakar Vault Protocol for zero-knowledge operations delegation.",
    },
    {
      name: "Compliance Officer",
      description:
        "Audit-readiness and coverage proof are the primary concerns. Pain: can't answer 'what % of assets are protected?' without manual effort. Values real-time unified backup posture, automated compliance workflows, and audit-ready reports.",
    },
  ],
  messagingJson: [
    "Zero-trust by architecture, not by marketing: deduplication and encryption both happen client-side, before data leaves the source.",
    "Solve the encryption-vs-efficiency trade-off: 90%+ storage and egress cost reduction without sacrificing encryption or zero-trust.",
    "Petabyte-scale, index-in-snapshot architecture: no central catalog database, no catalog collapse under millions of inodes.",
    "Open format, 50+ year guarantee: PTAR and Kloset are open-source and publicly auditable — your data is readable without Plakar software.",
    "Instant mount and browse: access terabytes of backup data as a local filesystem without restoring — recover a single file in seconds.",
    "Unified Backup Posture (Enterprise): single pane of glass across on-prem, cloud, and SaaS with real-time protection coverage map.",
    "Plakar Vault Protocol: safely delegate backup operations to MSPs or departments without sharing encryption keys.",
    "CNCF member (Linux Foundation, January 2026): publicly audited cryptography, community-built connectors, no vendor dependence.",
  ],
  positioningText:
    "Plakar is the open-source resilience layer for enterprises that can no longer afford to choose between security and efficiency. By performing deduplication and encryption client-side — before data leaves the source — Plakar delivers 90%+ storage cost reduction without ever exposing encryption keys to infrastructure, MSPs, or even the backup admin. Plakar Enterprise adds a unified posture management layer that gives CISOs and IT leadership a real-time, audit-ready view of protection coverage across on-prem, cloud, and SaaS — eliminating the coverage blind spots that legacy backup tools leave behind.",
  regionsJson: ["Europe", "North America", "APAC"],
  competitorsJson: [
    "Veeam",
    "Commvault",
    "Rubrik",
    "Cohesity",
    "restic",
    "BorgBackup",
    "AWS Backup",
    "Druva",
  ],
  cplTargetsJson: {
    conference: 0,
    meetup: 0,
    analyst: 0,
  },
  budgetRangesJson: {
    Platinum: { min: 0, max: 0 },
    Gold: { min: 0, max: 0 },
    Silver: { min: 0, max: 0 },
    Community: { min: 0, max: 0 },
  },
  leadEstimatesJson: {
    conference: 0,
    meetup: 0,
    analyst: 0,
    community: 0,
  },
  avgDealValue: 0,
  leadToOppRate: 0,
  overheadPerEventJson: {
    conference: 0,
    meetup: 0,
    analyst: 0,
    community: 0,
  },
  calendarName: "Plakar Events",
};

export async function GET() {
  try {
    let profile = await prisma.companyProfile.findFirst();

    if (!profile) {
      profile = await prisma.companyProfile.create({
        data: DEFAULT_PROFILE,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.companyName || body.companyName.trim() === "") {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }
    if (!body.description || body.description.trim() === "") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Coerce numeric fields
    const avgDealValue = parseFloat(body.avgDealValue) || 0;
    const leadToOppRate = parseFloat(body.leadToOppRate) || 0;

    let profile = await prisma.companyProfile.findFirst();

    if (profile) {
      profile = await prisma.companyProfile.update({
        where: { id: profile.id },
        data: {
          companyName: body.companyName,
          description: body.description,
          productsJson: body.productsJson ?? [],
          personasJson: body.personasJson ?? [],
          messagingJson: body.messagingJson ?? [],
          positioningText: body.positioningText ?? "",
          regionsJson: body.regionsJson ?? [],
          competitorsJson: body.competitorsJson ?? [],
          cplTargetsJson: body.cplTargetsJson ?? {},
          budgetRangesJson: body.budgetRangesJson ?? {},
          leadEstimatesJson: body.leadEstimatesJson ?? {},
          avgDealValue,
          leadToOppRate,
          overheadPerEventJson: body.overheadPerEventJson ?? {},
          calendarName: body.calendarName ?? "Plakar Events",
        },
      });
    } else {
      profile = await prisma.companyProfile.create({
        data: {
          companyName: body.companyName,
          description: body.description,
          productsJson: body.productsJson ?? [],
          personasJson: body.personasJson ?? [],
          messagingJson: body.messagingJson ?? [],
          positioningText: body.positioningText ?? "",
          regionsJson: body.regionsJson ?? [],
          competitorsJson: body.competitorsJson ?? [],
          cplTargetsJson: body.cplTargetsJson ?? {},
          budgetRangesJson: body.budgetRangesJson ?? {},
          leadEstimatesJson: body.leadEstimatesJson ?? {},
          avgDealValue,
          leadToOppRate,
          overheadPerEventJson: body.overheadPerEventJson ?? {},
          calendarName: body.calendarName ?? "Plakar Events",
        },
      });
    }

    // Mark all EventScore records as stale (set confidence to 'low')
    await prisma.eventScore.updateMany({
      data: {
        confidence: "low",
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}
