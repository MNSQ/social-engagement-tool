# Social Media Engagement Tool

A human-in-the-loop dashboard that ranks X/Twitter posts by engagement opportunity so users can decide which ones to reply to.

The app does **not** post automatically or generate replies. It surfaces high-value conversations and keeps the decision entirely with the user.

---

## What it does

The tool analyzes a batch of posts and scores each one across six dimensions. Results are ranked and presented as opportunity cards, each with the post content, engagement metrics, a score badge, a one-sentence explanation, and a direct link to open the post on X.

Admins can tune the keyword lists and scoring weights via an in-app settings panel. Regular users see only the ranked dashboard.

---

## Core features

- **Ranked opportunity cards** — top 10 posts sorted by composite score, with priority tier badges (Top / Strong / Medium / Low)
- **Six-dimension scoring** — topic relevance, engagement metrics, reply opportunity, strategic value, freshness, and risk penalty
- **Safety filtering** — posts flagged as spam, token hype, or unsafe are suppressed or marked "Avoid"
- **Per-card explanations** — deterministic, human-readable reason for each card's ranking
- **Admin keyword editor** — edit core brand keywords, market keywords, opportunity triggers, and risk keywords in the UI
- **JSON post import** — admins can paste a JSON array of posts to replace the active dataset
- **Google OAuth access control** — configurable allowlist of permitted emails; separate admin list
- **CSV demo data** — 1,000 synthetic posts shipped in the repo for local and deployed demos

---

## Architecture overview

```
Browser (React / Tailwind)
    │
    └─► Next.js App Router (server components + client components)
            │
            ├─ Auth gate (Auth.js v5 / Google OAuth)
            │       Reads ALLOWED_EMAILS and ADMIN_EMAILS from env.
            │       Rejects sign-in for any email not on the list.
            │
            ├─ Data source (CSV → fallback hardcoded posts)
            │       Loads public/test-data/synthetic_tweets_1000.csv at
            │       server render time. Falls back to samplePosts if missing.
            │
            └─ Scoring engine (pure TypeScript, runs on the client)
                    Receives posts as props, scores and ranks them in the
                    browser via useMemo so results update instantly when
                    the admin changes keywords or imports new data.
```

---

## Scoring overview

Each post is scored 0–100 across six dimensions:

| Dimension | Max | Description |
|---|---|---|
| Topic relevance | 30 | Matches core brand keywords (DePIN, GPU, inference…) or broader market terms |
| Engagement potential | 20 | Views, replies, likes, reposts, and author follower count |
| Reply opportunity | 20 | Pricing complaints, questions, comparisons, strong opinions, pain points |
| Strategic value | 15 | Post connects to a specific talking point (GPU shortage, hyperscaler cost…) |
| Freshness | 10 | Full points for posts under 2 hours old; zero for posts over 3 days old |
| Risk penalty | −30 max | Token hype, airdrop/giveaway language, scam signals, unsafe content |

Priority tiers: **Top opportunity** (≥ 85) · **Strong** (≥ 70) · **Medium** (≥ 50) · **Low** (≥ 30) · **Ignore** (< 30)

Posts that score "Ignore" or are flagged "Avoid" are hidden from the ranked list.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js v5 (NextAuth) with Google provider |
| Data | CSV file (demo) / JSON paste (admin import) |
| Deployment | Vercel |

---

## Project structure

```
src/
  app/
    api/auth/[...nextauth]/route.ts   Auth.js catch-all handler
    layout.tsx
    page.tsx                          Root server component: auth gate + CSV load
  auth.ts                             Google provider config, email allowlist, isAdmin flag
  components/
    Dashboard.tsx                     Main client component: scoring, filtering, display
    KeywordSettings.tsx               Admin-only keyword editor
    LoginScreen.tsx                   Unauthenticated landing screen
    OpportunityCard.tsx               Per-post ranked card with score, explanation, link
    PostInput.tsx                     Admin JSON import panel
    ScoreBadge.tsx                    Score number + priority tier badge
    StatsCards.tsx                    Summary stats row (analyzed / opportunities / avg score)
  lib/
    csvPosts.ts                       CSV loader and parser
    keywordConfig.ts                  Default keyword groups (editable in UI)
    samplePosts.ts                    Hardcoded fallback posts
    scoring.ts                        Six-dimension scoring engine (pure functions)
    types.ts                          Shared TypeScript types
  types/
    next-auth.d.ts                    Auth.js session type augmentation (isAdmin)
scripts/
  generate-tweets.mjs                 Synthetic tweet generator (npm run generate:tweets)
public/
  test-data/
    synthetic_tweets_1000.csv         Demo dataset — 1,000 synthetic posts
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values before running locally.

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | Random secret used to sign Auth.js sessions. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Prod only | Full public URL of the app (e.g. `https://your-app.vercel.app`). Not needed locally. |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `ALLOWED_EMAILS` | Yes | Comma-separated list of emails permitted to sign in |
| `ADMIN_EMAILS` | Yes | Comma-separated list of emails that get admin access |

`ADMIN_EMAILS` entries are automatically included in `ALLOWED_EMAILS`, so you do not need to list them twice.

---

## Local setup

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/MNSQ/social-engagement-tool.git
cd social-engagement-tool
npm install

cp .env.example .env.local
# Edit .env.local with your Google OAuth credentials and email lists

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Vercel deployment

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add the environment variables listed above in the Vercel dashboard under **Settings → Environment Variables**.
4. Set `AUTH_URL` to your deployed app URL.
5. Deploy.

The CSV demo data (`public/test-data/synthetic_tweets_1000.csv`) is committed to the repo and is served as a static file, so no additional data setup is needed on Vercel.

---

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** for a Web application.
3. Add the following **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-app.vercel.app/api/auth/callback/google`
4. Copy the Client ID and Client Secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

---

## Usage flow

1. User visits the app and signs in with Google.
2. Auth.js checks the email against `ALLOWED_EMAILS`. Non-listed emails are rejected.
3. The server loads `synthetic_tweets_1000.csv` and passes the posts to the dashboard.
4. The client scores all posts and displays the top 10 ranked opportunity cards.
5. Each card shows the author, post text, engagement metrics, score badge, one-sentence explanation, and an **Open on X** button.
6. The user reviews the ranked list and decides which posts to reply to manually.

---

## Admin settings

Users listed in `ADMIN_EMAILS` see two additional panels:

- **Keyword Settings** — edit the four keyword groups (core brand, market, opportunity triggers, risk keywords) that drive the scoring engine. Changes apply immediately without a reload.
- **Import Posts** — paste a JSON array of post objects to replace the current dataset. Useful for testing with real exported data.

---

## Security and access

- Sign-in is restricted to emails in `ALLOWED_EMAILS` + `ADMIN_EMAILS`. No self-registration.
- Sessions are JWT-based (no database required).
- The `isAdmin` flag is set server-side from `ADMIN_EMAILS` and stored in the JWT — it is not user-controlled.
- The app has no write endpoints and makes no external API calls at runtime. All scoring runs client-side.

---

## Known limitations

- **CSV/mock data only.** The current MVP loads a synthetic dataset. There is no live connection to the X/Twitter API.
- **X API integration is not active.** Free-tier X API quota was insufficient for the use case. API integration is planned as a future improvement.
- **No auto-reply or automation.** The tool surfaces opportunities only. All engagement decisions and replies are made manually by the user.
- **Heuristic scoring.** The six-dimension model is rule-based. Weights and thresholds have not been calibrated against real engagement outcome data.
- **Admin UI is MVP-level.** Keyword edits are in-memory only and reset on page reload.
- **Single-user, email-allowlist model.** There is no multi-user workspace or role management beyond the admin/user split.

---

## Future improvements

- **X API integration** — pull live posts when API access and quota are available
- **Persistent keyword storage** — save admin keyword edits to a database so changes survive reloads
- **Scheduled data refresh** — automatically fetch and score new posts every few hours
- **Better scoring calibration** — tune weights against real reply engagement outcomes
- **User/team workspaces** — support multiple accounts with separate keyword configs
- **Saved opportunities** — let users bookmark or mark posts as acted on
- **Export and reporting** — CSV or summary export of ranked opportunities
- **Broader topic presets** — out-of-the-box keyword configs for niches beyond AI/DePIN/GPU
