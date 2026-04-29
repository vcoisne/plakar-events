# Plakar Events

AI-powered field marketing event intelligence and ROI planning tool. Plakar Events automates conference and meetup discovery, scores each event against your company strategy, and generates CPL estimates, ROI projections, and Claude-powered strategy briefs — so field marketers can make fast, defensible investment decisions without hours of manual research.

## What it does

| Feature | Description |
|---|---|
| **Event discovery** | Ingests events daily from Luma and Eventbrite/Confs.tech; deduplicates by URL and fuzzy name match |
| **Scoring engine** | Scores each event 0–100 across 6 dimensions (audience match, topic relevance, strategic alignment, budget fit, competitor signal, sentiment) using Claude Haiku |
| **CPL estimate** | Cost-per-lead range derived from sponsorship cost and attendance; benchmarked against your configured target |
| **ROI projection** | Multiplier estimate with editable inputs; all formula inputs shown transparently |
| **Strategy briefs** | One-click Claude Sonnet generation: messaging angles, staffing, side event ideas, partner opps |
| **CFP support** | Tracks open CFP deadlines; generates 3 talk angles and a full proposal draft per event |
| **Competitor intelligence** | Scrapes event websites to detect which competitors are sponsoring |
| **Planning board** | Quarterly view with budget tracker, status workflow (Candidate → Shortlisted → Approved → Rejected) |
| **Google Calendar sync** | Approved events are automatically pushed to your "Plakar Events" Google Calendar |
| **Auth** | Google OAuth restricted to @plakar.io email domain |

## Architecture

```
plakar-events/
├── app/                        # Next.js 14 App Router
│   ├── page.tsx                # Dashboard — stats, CFP deadlines, top events
│   ├── events/
│   │   ├── page.tsx            # Event Explorer — filterable list with CPL badges
│   │   └── [id]/page.tsx       # Event Detail — full assessment page
│   ├── planning/page.tsx       # Planning Board — quarterly view + CSV export
│   ├── profile/page.tsx        # Company Profile — all scoring inputs
│   └── api/
│       ├── auth/[...nextauth]  # NextAuth Google OAuth handler
│       ├── events/             # CRUD + score/roi/status/strategy/competitors per event
│       ├── ingest/             # Manual ingestion trigger
│       ├── cron/daily/         # Cron-protected daily refresh endpoint
│       ├── dashboard/          # Dashboard stats aggregation
│       ├── planning/           # Planning board data
│       └── profile/            # Company profile CRUD + calendar test
│
├── lib/
│   ├── scoring.ts              # Claude Haiku scoring + heuristic fallback
│   ├── roi.ts                  # CPL/ROI calculation with override support
│   ├── recommendation.ts       # Deterministic Sponsor/Speak/Attend/Pass logic
│   ├── strategy.ts             # Claude Sonnet strategy brief generation
│   ├── competitors.ts          # Event website scrape + Claude competitor extraction
│   ├── gcal.ts                 # Google Calendar REST API (JWT auth, no googleapis package)
│   ├── auth.ts                 # NextAuth config + @plakar.io domain guard
│   ├── prisma.ts               # Prisma singleton client
│   └── ingestion/
│       ├── luma.ts             # Luma API + HTML fallback
│       ├── web.ts              # Eventbrite + Confs.tech GitHub JSON
│       └── index.ts            # Ingestion orchestrator
│
├── prisma/
│   ├── schema.prisma           # Full data model (9 models)
│   └── seed.ts                 # 15 seed events including GITEX, KubeCon, PlatformCon, Devoxx
│
└── vercel.json                 # Cron schedule: daily at 02:00 UTC
```

### Data model

| Model | Purpose |
|---|---|
| `CompanyProfile` | Single record: company context, CPL targets, budget ranges, ROI defaults |
| `Event` | Core event record: name, dates, location, topics, attendance, source |
| `EventScore` | 6 sub-scores + total (0–100) + confidence + explanation text |
| `EventROI` | CPL range, ROI multiplier, calculation inputs, user overrides |
| `CompetitorSignal` | Per-competitor sponsor status, tier, evidence, confidence |
| `EventStrategy` | Recommendation type, strategy brief, CFP angles, proposal draft |
| `PlanningStatus` | Status workflow + owner + notes + gcal_event_id |

### AI layer

| Task | Model | Notes |
|---|---|---|
| Event scoring explanations | `claude-haiku-4-5-20251001` | Cached system prompt; heuristic fallback if no key |
| Recommendation reason | `claude-haiku-4-5-20251001` | Cached system prompt |
| Strategy briefs + CFP angles | `claude-sonnet-4-6` | Higher quality; generated on demand |
| Competitor extraction | `claude-haiku-4-5-20251001` | From scraped event HTML |

---

## Local setup

### Prerequisites

- Node.js 18+
- PostgreSQL (see install steps below)
- A Google Cloud project (for OAuth)
- An Anthropic API key

### 1. Install PostgreSQL locally

```bash
brew install postgresql@16
brew services start postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Create the database:
```bash
createdb plakar_events
```

Your local `DATABASE_URL` will be:
```
DATABASE_URL=postgresql://localhost:5432/plakar_events
```

> No username/password needed for local connections on macOS by default.

### 2. Clone and install

```bash
git clone https://github.com/vcoisne/plakar-events
cd plakar-events
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see the [Credentials guide](#credentials-guide) below.

### 4. Run database migrations and seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to Google sign-in. Only `@plakar.io` accounts can authenticate.

After signing in, go to **Company Profile** first to review the pre-seeded Plakar context, then hit **Discover Events** on the dashboard to pull live events.

---

## Credentials guide

### NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

### Google OAuth (sign-in, @plakar.io only)

1. [console.cloud.google.com](https://console.cloud.google.com) → New Project → `Plakar Events`
2. **APIs & Services → OAuth consent screen**
   - User type: **Internal** (restricts to your Google Workspace org at the OAuth level)
   - App name: `Plakar Events`
3. **Credentials → + Create Credentials → OAuth 2.0 Client ID**
   - Type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`

> When deploying, add your production URL as a second redirect URI in the same OAuth client — no need to create a new one.

### Anthropic API key

1. [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys → Create Key
2. Copy into `.env.local` as `ANTHROPIC_API_KEY`

> Without this key, scoring and strategy generation fall back to heuristic mode — the app still works, but AI explanations and briefs will be templated rather than generated.

### CRON_SECRET
```bash
openssl rand -base64 32
```
Used to protect the `/api/cron/daily` endpoint from unauthorized triggers.

### Google Calendar service account (optional for local dev)

Leave `GOOGLE_CALENDAR_CREDENTIALS={}` while developing locally — the app shows a non-blocking warning when calendar sync is unavailable. Set this up before production:

1. Google Cloud Console → **IAM & Admin → Service Accounts → + Create Service Account** → name: `plakar-events-calendar`
2. Click the account → **Keys → Add Key → Create new key → JSON** → download the file
3. Minify the JSON to one line:
   ```bash
   cat ~/Downloads/plakar-events-*.json | python3 -m json.tool --compact
   ```
4. Paste as the value of `GOOGLE_CALENDAR_CREDENTIALS` in `.env.local`
5. In Google Calendar, share your `Plakar Events` calendar with the service account email (`...@...iam.gserviceaccount.com`) with **"Make changes to events"** permission
6. Test the connection from **Company Profile → Google Calendar → Test connection**

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | App base URL (`http://localhost:3000` locally) |
| `NEXTAUTH_SECRET` | Yes | Random secret for session signing |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | Recommended | Powers scoring, strategy, CFP, competitor extraction |
| `CRON_SECRET` | Yes | Protects `/api/cron/daily` endpoint |
| `GOOGLE_CALENDAR_CREDENTIALS` | Optional | Service account JSON (minified) for calendar push |

---

## Deploying to production (Railway)

1. Push your code to GitHub (already done at `vcoisne/plakar-events`)
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select `vcoisne/plakar-events`
3. Add a PostgreSQL plugin to the same project — Railway injects `DATABASE_URL` automatically
4. In the Railway service settings → Variables → add all env vars from the table above
5. Update `NEXTAUTH_URL` to your Railway production URL
6. Add the Railway URL as a second **Authorized redirect URI** in your Google Cloud OAuth client:
   ```
   https://your-app.railway.app/api/auth/callback/google
   ```
7. Railway auto-deploys on every push to `main`

The Vercel cron in `vercel.json` won't run on Railway — set up a Railway cron service or use an external scheduler (cron-job.org) to POST to `/api/cron/daily` with the `x-cron-secret` header.

---

## MVP definition of done

- [x] Sign in with @plakar.io Google account
- [x] Configure company profile (CPL targets, budget, deal value, competitors)
- [x] Browse events with filters (region, type, source, CPL range, status)
- [x] Each event shows score, CPL estimate, ROI label, CPL benchmark
- [x] All CPL/ROI inputs visible + user-overridable with live recalculation
- [x] Competitor section with confidence and evidence
- [x] CFP talk angles and proposal draft generation
- [x] Shortlist events and view planning board by quarter
- [x] Approve event → auto-creates Google Calendar event
- [x] GITEX, KubeCon, PlatformCon, Devoxx in seed data
- [x] Daily refresh cron with stale score recomputation
- [x] Luma events ingested from live API
