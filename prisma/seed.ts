import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to compute CPL and ROI label
function computeROI(
  sponsorshipCost: number | null,
  attendanceEstimate: number | null,
  eventType: string
): {
  cplLow: number | null;
  cplHigh: number | null;
  roiLabel: string;
  estimatedLeads: number | null;
} {
  if (!sponsorshipCost || !attendanceEstimate) {
    return { cplLow: null, cplHigh: null, roiLabel: "Unknown", estimatedLeads: null };
  }
  const conversionRate = 0.02;
  const estimatedLeads = Math.round(attendanceEstimate * conversionRate);
  if (estimatedLeads === 0) {
    return { cplLow: null, cplHigh: null, roiLabel: "Unknown", estimatedLeads: 0 };
  }
  const cplMid = sponsorshipCost / estimatedLeads;
  const cplLow = Math.round(cplMid * 0.8);
  const cplHigh = Math.round(cplMid * 1.2);

  const target = eventType === "meetup" ? 150 : 250;
  let roiLabel = "Unknown";
  if (cplMid <= target * 0.7) roiLabel = "Strong";
  else if (cplMid <= target * 1.1) roiLabel = "Moderate";
  else roiLabel = "Weak";

  return { cplLow, cplHigh, roiLabel, estimatedLeads };
}

const events = [
  // === 4 required events ===
  {
    name: "GITEX Global",
    url: "https://gitex.com",
    organizer: "GITEX Technology Week",
    startDate: new Date("2025-10-13"),
    endDate: new Date("2025-10-17"),
    city: "Dubai",
    country: "UAE",
    region: "MENA",
    description:
      "Largest tech event in MENA; premium sponsorship tiers; high enterprise pipeline density",
    topicsJson: ["enterprise tech", "cloud", "AI", "investors", "digital transformation"],
    eventType: "conference",
    attendanceEstimate: 100000,
    sponsorshipCost: 50000,
    cfpDeadline: null,
    source: "web",
    score: { totalScore: 78, audienceMatch: 70, topicRelevance: 75, strategicAlignment: 82, budgetFit: 65, competitorSignal: 80, sentiment: 78, confidence: "medium" },
  },
  {
    name: "KubeCon + CloudNativeCon Europe 2025",
    url: "https://events.linuxfoundation.org/kubecon-cloudnativecon-europe/",
    organizer: "Linux Foundation",
    startDate: new Date("2025-04-01"),
    endDate: new Date("2025-04-04"),
    city: "London",
    country: "UK",
    region: "Europe",
    description:
      "Flagship cloud-native event; core audience overlap with Plakar; strong CFP culture",
    topicsJson: ["kubernetes", "cloud native", "platform engineering", "SRE", "DevOps", "containers"],
    eventType: "conference",
    attendanceEstimate: 10000,
    sponsorshipCost: 25000,
    cfpDeadline: new Date("2024-12-01"),
    source: "web",
    score: { totalScore: 88, audienceMatch: 92, topicRelevance: 90, strategicAlignment: 88, budgetFit: 72, competitorSignal: 90, sentiment: 88, confidence: "medium" },
  },
  {
    name: "PlatformCon 2025",
    url: "https://platformcon.com",
    organizer: "PlatformCon Community",
    startDate: new Date("2025-06-12"),
    endDate: new Date("2025-06-13"),
    city: "Online",
    country: "Global",
    region: "Global",
    description:
      "Fastest-growing platform engineering conference; community-driven; CFP-friendly",
    topicsJson: ["platform engineering", "DevOps", "IDP", "developer experience", "internal platforms"],
    eventType: "conference",
    attendanceEstimate: 6000,
    sponsorshipCost: 5000,
    cfpDeadline: new Date("2025-03-01"),
    source: "web",
    score: { totalScore: 82, audienceMatch: 88, topicRelevance: 90, strategicAlignment: 84, budgetFit: 92, competitorSignal: 72, sentiment: 82, confidence: "medium" },
  },
  {
    name: "Devoxx Belgium 2025",
    url: "https://devoxx.be",
    organizer: "Devoxx",
    startDate: new Date("2025-10-06"),
    endDate: new Date("2025-10-10"),
    city: "Antwerp",
    country: "Belgium",
    region: "Europe",
    description:
      "Highly respected CFP; strong developer brand-building; multiple European editions",
    topicsJson: ["Java", "JVM", "open source", "architecture", "cloud", "developer tools"],
    eventType: "conference",
    attendanceEstimate: 3000,
    sponsorshipCost: 15000,
    cfpDeadline: new Date("2025-05-01"),
    source: "web",
    score: { totalScore: 74, audienceMatch: 76, topicRelevance: 72, strategicAlignment: 74, budgetFit: 78, competitorSignal: 68, sentiment: 74, confidence: "medium" },
  },

  // === 11 additional events ===
  {
    name: "DockerCon 2025",
    url: "https://dockercon.com",
    organizer: "Docker Inc.",
    startDate: new Date("2025-05-20"),
    endDate: new Date("2025-05-21"),
    city: "San Francisco",
    country: "USA",
    region: "North America",
    description:
      "Premier container and developer tools conference; strong overlap with DevOps and platform engineering audiences",
    topicsJson: ["containers", "DevOps", "developer tools", "platform engineering", "cloud native"],
    eventType: "conference",
    attendanceEstimate: 5000,
    sponsorshipCost: 20000,
    cfpDeadline: new Date("2025-02-15"),
    source: "web",
    score: { totalScore: 80, audienceMatch: 84, topicRelevance: 80, strategicAlignment: 80, budgetFit: 76, competitorSignal: 82, sentiment: 80, confidence: "medium" },
  },
  {
    name: "HashiConf 2025",
    url: "https://hashiconf.com",
    organizer: "HashiCorp",
    startDate: new Date("2025-09-10"),
    endDate: new Date("2025-09-12"),
    city: "Boston",
    country: "USA",
    region: "North America",
    description:
      "Infrastructure-as-code focused; strong SRE and platform engineering audience; Vault users overlap with zero-trust positioning",
    topicsJson: ["infrastructure", "DevOps", "SRE", "security", "cloud", "automation"],
    eventType: "conference",
    attendanceEstimate: 4000,
    sponsorshipCost: 18000,
    cfpDeadline: new Date("2025-06-01"),
    source: "web",
    score: { totalScore: 76, audienceMatch: 80, topicRelevance: 76, strategicAlignment: 78, budgetFit: 74, competitorSignal: 76, sentiment: 76, confidence: "medium" },
  },
  {
    name: "SREcon Americas 2025",
    url: "https://www.usenix.org/srecon25americas",
    organizer: "USENIX",
    startDate: new Date("2025-03-17"),
    endDate: new Date("2025-03-19"),
    city: "Santa Clara",
    country: "USA",
    region: "North America",
    description:
      "Top SRE community conference; practitioner-driven; high density of reliability and resilience engineers",
    topicsJson: ["SRE", "reliability", "observability", "incident response", "resilience", "DevOps"],
    eventType: "conference",
    attendanceEstimate: 2000,
    sponsorshipCost: 12000,
    cfpDeadline: new Date("2024-11-30"),
    source: "web",
    score: { totalScore: 85, audienceMatch: 90, topicRelevance: 86, strategicAlignment: 86, budgetFit: 80, competitorSignal: 78, sentiment: 85, confidence: "medium" },
  },
  {
    name: "DevOpsDays London 2025",
    url: "https://devopsdays.org/events/2025-london",
    organizer: "DevOpsDays",
    startDate: new Date("2025-07-14"),
    endDate: new Date("2025-07-15"),
    city: "London",
    country: "UK",
    region: "Europe",
    description:
      "Community-driven DevOps event; practitioner talks and open spaces; strong sponsor visibility at small scale",
    topicsJson: ["DevOps", "platform engineering", "SRE", "culture", "automation", "cloud"],
    eventType: "meetup",
    attendanceEstimate: 400,
    sponsorshipCost: 3000,
    cfpDeadline: new Date("2025-05-15"),
    source: "luma",
    score: { totalScore: 70, audienceMatch: 74, topicRelevance: 72, strategicAlignment: 68, budgetFit: 88, competitorSignal: 60, sentiment: 70, confidence: "medium" },
  },
  {
    name: "DevOpsDays Amsterdam 2025",
    url: "https://devopsdays.org/events/2025-amsterdam",
    organizer: "DevOpsDays",
    startDate: new Date("2025-06-05"),
    endDate: new Date("2025-06-06"),
    city: "Amsterdam",
    country: "Netherlands",
    region: "Europe",
    description:
      "One of Europe's top DevOps practitioner events; engaged community; strong talk-driven sponsorship",
    topicsJson: ["DevOps", "SRE", "platform engineering", "open source", "automation"],
    eventType: "meetup",
    attendanceEstimate: 350,
    sponsorshipCost: 2500,
    cfpDeadline: new Date("2025-04-01"),
    source: "luma",
    score: { totalScore: 68, audienceMatch: 72, topicRelevance: 70, strategicAlignment: 66, budgetFit: 90, competitorSignal: 58, sentiment: 68, confidence: "medium" },
  },
  {
    name: "Open Source Summit Europe 2025",
    url: "https://events.linuxfoundation.org/open-source-summit-europe/",
    organizer: "Linux Foundation",
    startDate: new Date("2025-08-25"),
    endDate: new Date("2025-08-28"),
    city: "Vienna",
    country: "Austria",
    region: "Europe",
    description:
      "Broad open-source community; good for brand awareness among OSS contributors and decision-makers",
    topicsJson: ["open source", "Linux", "cloud", "security", "developer tools", "community"],
    eventType: "conference",
    attendanceEstimate: 3500,
    sponsorshipCost: 10000,
    cfpDeadline: new Date("2025-06-01"),
    source: "web",
    score: { totalScore: 72, audienceMatch: 74, topicRelevance: 70, strategicAlignment: 72, budgetFit: 84, competitorSignal: 66, sentiment: 72, confidence: "medium" },
  },
  {
    name: "AWS re:Invent 2025",
    url: "https://reinvent.awsevents.com",
    organizer: "Amazon Web Services",
    startDate: new Date("2025-12-01"),
    endDate: new Date("2025-12-05"),
    city: "Las Vegas",
    country: "USA",
    region: "North America",
    description:
      "Largest cloud computing conference; massive enterprise pipeline; high sponsorship cost but unmatched reach",
    topicsJson: ["cloud", "AWS", "enterprise tech", "security", "storage", "DevOps", "AI"],
    eventType: "conference",
    attendanceEstimate: 50000,
    sponsorshipCost: 30000,
    cfpDeadline: null,
    source: "web",
    score: { totalScore: 62, audienceMatch: 70, topicRelevance: 60, strategicAlignment: 64, budgetFit: 48, competitorSignal: 72, sentiment: 62, confidence: "medium" },
  },
  {
    name: "CNCF Meetup Paris",
    url: "https://www.meetup.com/fr-FR/cloud-native-computing-paris/",
    organizer: "CNCF",
    startDate: new Date("2025-05-08"),
    endDate: new Date("2025-05-08"),
    city: "Paris",
    country: "France",
    region: "Europe",
    description:
      "Monthly CNCF local chapter; cloud-native practitioners; cost-effective brand building in French ecosystem",
    topicsJson: ["kubernetes", "cloud native", "DevOps", "containers", "platform engineering"],
    eventType: "community",
    attendanceEstimate: 150,
    sponsorshipCost: 500,
    cfpDeadline: new Date("2025-04-20"),
    source: "luma",
    score: { totalScore: 65, audienceMatch: 78, topicRelevance: 76, strategicAlignment: 60, budgetFit: 95, competitorSignal: 50, sentiment: 65, confidence: "medium" },
  },
  {
    name: "Monitorama 2025",
    url: "https://monitorama.com",
    organizer: "Monitorama",
    startDate: new Date("2025-06-23"),
    endDate: new Date("2025-06-25"),
    city: "Portland",
    country: "USA",
    region: "North America",
    description:
      "Community-driven observability and monitoring conference; practitioner-heavy; SRE and platform engineers",
    topicsJson: ["observability", "monitoring", "SRE", "reliability", "open source", "DevOps"],
    eventType: "community",
    attendanceEstimate: 400,
    sponsorshipCost: 4000,
    cfpDeadline: new Date("2025-03-30"),
    source: "web",
    score: { totalScore: 71, audienceMatch: 80, topicRelevance: 74, strategicAlignment: 68, budgetFit: 86, competitorSignal: 62, sentiment: 71, confidence: "medium" },
  },
  {
    name: "KubeCon + CloudNativeCon India 2025",
    url: "https://events.linuxfoundation.org/kubecon-cloudnativecon-india/",
    organizer: "Linux Foundation",
    startDate: new Date("2025-08-06"),
    endDate: new Date("2025-08-08"),
    city: "Hyderabad",
    country: "India",
    region: "APAC",
    description:
      "Growing APAC cloud-native community; cost-effective sponsorship; strong developer audience",
    topicsJson: ["kubernetes", "cloud native", "DevOps", "platform engineering", "containers"],
    eventType: "conference",
    attendanceEstimate: 3000,
    sponsorshipCost: 8000,
    cfpDeadline: new Date("2025-05-15"),
    source: "web",
    score: { totalScore: 67, audienceMatch: 72, topicRelevance: 72, strategicAlignment: 64, budgetFit: 82, competitorSignal: 60, sentiment: 67, confidence: "medium" },
  },
  {
    name: "CloudExpo Asia 2025",
    url: "https://cloudexpoasia.com",
    organizer: "Informa Tech",
    startDate: new Date("2025-10-22"),
    endDate: new Date("2025-10-23"),
    city: "Singapore",
    country: "Singapore",
    region: "APAC",
    description:
      "Enterprise IT and cloud event in Southeast Asia; good for regional enterprise pipeline and partner discovery",
    topicsJson: ["cloud", "enterprise tech", "security", "digital transformation", "storage"],
    eventType: "conference",
    attendanceEstimate: 8000,
    sponsorshipCost: 15000,
    cfpDeadline: null,
    source: "web",
    score: { totalScore: 58, audienceMatch: 62, topicRelevance: 56, strategicAlignment: 60, budgetFit: 60, competitorSignal: 54, sentiment: 58, confidence: "medium" },
  },
  {
    name: "SRE Weekly Meetup NYC",
    url: "https://www.meetup.com/sre-nyc/",
    organizer: "SRE NYC",
    startDate: new Date("2025-07-10"),
    endDate: new Date("2025-07-10"),
    city: "New York",
    country: "USA",
    region: "North America",
    description:
      "Monthly SRE practitioner meetup in NYC; tight-knit community; very low cost; great for brand awareness",
    topicsJson: ["SRE", "reliability", "incident response", "DevOps", "observability"],
    eventType: "meetup",
    attendanceEstimate: 80,
    sponsorshipCost: 500,
    cfpDeadline: new Date("2025-06-20"),
    source: "luma",
    score: { totalScore: 60, audienceMatch: 76, topicRelevance: 70, strategicAlignment: 56, budgetFit: 96, competitorSignal: 48, sentiment: 60, confidence: "medium" },
  },
  {
    name: "Gartner IT Symposium/Xpo 2025",
    url: "https://www.gartner.com/en/conferences/na/symposium-us",
    organizer: "Gartner",
    startDate: new Date("2025-10-19"),
    endDate: new Date("2025-10-23"),
    city: "Orlando",
    country: "USA",
    region: "North America",
    description:
      "Top analyst/CIO event; enterprise decision-maker density; high cost but strong pipeline quality for Enterprise tier",
    topicsJson: ["enterprise tech", "cloud", "AI", "security", "digital transformation", "vendor selection"],
    eventType: "conference",
    attendanceEstimate: 9000,
    sponsorshipCost: 30000,
    cfpDeadline: null,
    source: "web",
    score: { totalScore: 55, audienceMatch: 60, topicRelevance: 50, strategicAlignment: 58, budgetFit: 42, competitorSignal: 62, sentiment: 55, confidence: "medium" },
  },
  {
    name: "Fossdem 2026",
    url: "https://fosdem.org/2026/",
    organizer: "FOSDEM",
    startDate: new Date("2026-02-07"),
    endDate: new Date("2026-02-08"),
    city: "Brussels",
    country: "Belgium",
    region: "Europe",
    description:
      "World's largest free/open-source software event; Plakar's OSS story resonates strongly here; CFP-driven with high credibility",
    topicsJson: ["open source", "security", "storage", "developer tools", "Linux", "community"],
    eventType: "community",
    attendanceEstimate: 8000,
    sponsorshipCost: 2000,
    cfpDeadline: new Date("2025-11-01"),
    source: "web",
    score: { totalScore: 83, audienceMatch: 88, topicRelevance: 84, strategicAlignment: 82, budgetFit: 94, competitorSignal: 70, sentiment: 83, confidence: "medium" },
  },
  {
    name: "DevOpsDays Tel Aviv 2025",
    url: "https://devopsdays.org/events/2025-tel-aviv",
    organizer: "DevOpsDays",
    startDate: new Date("2025-09-03"),
    endDate: new Date("2025-09-04"),
    city: "Tel Aviv",
    country: "Israel",
    region: "MENA",
    description:
      "Thriving DevOps scene in Israel; tech-savvy audience; good for MENA regional presence beyond Gulf",
    topicsJson: ["DevOps", "SRE", "platform engineering", "cloud", "automation"],
    eventType: "meetup",
    attendanceEstimate: 250,
    sponsorshipCost: 2000,
    cfpDeadline: new Date("2025-07-01"),
    source: "luma",
    score: { totalScore: 62, audienceMatch: 66, topicRelevance: 64, strategicAlignment: 60, budgetFit: 90, competitorSignal: 54, sentiment: 62, confidence: "medium" },
  },
];

async function main() {
  console.log("Seeding database with 15 events...");

  for (const eventData of events) {
    const { score: scoreData, ...eventFields } = eventData;

    // Upsert the event
    const event = await prisma.event.upsert({
      where: { url: eventFields.url },
      update: {},
      create: {
        ...eventFields,
        topicsJson: eventFields.topicsJson,
      },
    });

    // Upsert EventScore
    await prisma.eventScore.upsert({
      where: { eventId: event.id },
      update: {},
      create: {
        eventId: event.id,
        totalScore: scoreData.totalScore,
        audienceMatch: scoreData.audienceMatch,
        topicRelevance: scoreData.topicRelevance,
        strategicAlignment: scoreData.strategicAlignment,
        budgetFit: scoreData.budgetFit,
        competitorSignal: scoreData.competitorSignal,
        sentiment: scoreData.sentiment,
        confidence: scoreData.confidence,
      },
    });

    // Compute ROI
    const roi = computeROI(
      eventFields.sponsorshipCost ?? null,
      eventFields.attendanceEstimate ?? null,
      eventFields.eventType
    );

    // Upsert EventROI
    await prisma.eventROI.upsert({
      where: { eventId: event.id },
      update: {},
      create: {
        eventId: event.id,
        estimatedCost: eventFields.sponsorshipCost ?? null,
        estimatedLeads: roi.estimatedLeads,
        cplLow: roi.cplLow,
        cplHigh: roi.cplHigh,
        roiLabel: roi.roiLabel,
      },
    });

    // Upsert PlanningStatus
    await prisma.planningStatus.upsert({
      where: { eventId: event.id },
      update: {},
      create: {
        eventId: event.id,
        status: "candidate",
      },
    });

    console.log(`  Seeded: ${event.name}`);
  }

  console.log("Done. 15 events seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
