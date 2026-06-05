# AVDP Sierra Leone — M&E Dashboard

Full-stack monitoring & evaluation dashboard for the IFAD-funded **Agriculture
Value Chain Development Project (AVDP)** in Sierra Leone: real-time regional
agricultural indicators, interactive district GIS, yield forecasting, a
Gemini-powered decision advisor, threshold alerting, field surveys, and a
low-bandwidth/offline-first field mode.

## Architecture

- **Frontend:** React 19 + Vite + Tailwind. Talks directly to Supabase.
- **Database / Auth:** Supabase (Postgres + Row Level Security + Supabase Auth).
  RBAC is enforced **server-side** by RLS — the client cannot bypass it.
  - `indicators` (progress & status are generated columns → always consistent),
    `indicator_history` (time-series, written by trigger), `alerts`, `surveys`,
    `survey_responses` (with gender/age disaggregation), `activity_logs`,
    `reports`, and `profiles` (role + district).
  - Daily M&E digest generated via `pg_cron`.
- **Server (`server.ts`):** thin Express layer — serves the app and hosts the
  Gemini advisor endpoint (grounded in live indicator data). All CRUD goes
  through Supabase directly.

Migrations live in `supabase/migrations/`.

## Run locally

**Prerequisites:** Node.js, a Supabase project.

1. Install dependencies:
   ```
   npm install
   ```
2. Apply the migrations in `supabase/migrations/` to your Supabase project
   (via the Supabase SQL editor or CLI), in order.
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
   VITE_SUPABASE_ANON_KEY="<your publishable/anon key>"
   GEMINI_API_KEY="<optional: enables the live AI advisor>"
   ```
4. Run:
   ```
   npm run dev      # dev server on http://localhost:3000
   npm run build    # production static build for Cloudflare Workers
   npm run build:server # optional self-hosted build (Vite + Express bundle)
   npm run start    # run the optional self-hosted production build
   npm run lint     # typecheck (tsc --noEmit)
   ```

## Deploy (Cloudflare Workers + Supabase)

The production URL uses **Cloudflare Workers Static Assets**
(`avdp-dashboard.mohamedbangura.workers.dev`) for the Vite frontend plus a
**Supabase Edge Function** for the AI advisor — no long-running server to
operate.

**Frontend → Cloudflare Workers (Connect to Git)**
1. Cloudflare dashboard → **Workers & Pages → Workers → Connect to Git** →
   select `baimasonga/AVDP-Dashboard`, production branch `main`.
2. Build command: `npm run build` · deploy command: `npx wrangler deploy`.
3. `wrangler.toml` points Workers Static Assets at `./dist` and enables
   single-page-app fallback for URLs like `/?tab=gis&district=Kailahun`.
4. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Cloudflare rebuilds and deploys automatically after the PR is merged into
   the configured production branch. If a rebuild still shows the old map,
   confirm the Worker is connected to that branch and not an older preview.

For a manual deploy from a machine with Wrangler credentials:
```
npm run deploy:worker
```

**AI advisor → Supabase Edge Function** (`supabase/functions/advisor`)
- Deploy: `supabase functions deploy advisor` (already deployed in this project).
- Set the key as a function secret to enable live Gemini:
  `supabase secrets set GEMINI_API_KEY=...` (without it the advisor returns a
  graceful fallback). `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected automatically.

**After deploy**
- In Supabase Auth settings, set the **Site URL / redirect URLs** to your Workers domain.
- Enable **leaked-password protection** in Supabase Auth (recommended).
- The daily report `pg_cron` job already runs on Supabase — nothing to host.

> `server.ts` is only used for local dev (and optional self-hosting via
> `npm run build:server` + `npm run start`); it is not part of the Cloudflare deployment.

The repo includes `.node-version` so Cloudflare Pages and other Node-aware hosts
use a Node runtime compatible with the current Vite React plugin during rebuilds.

## Roles (RBAC)

| Role | Capabilities |
|------|--------------|
| **Admin** | Edit any indicator, bulk CSV import, schedule surveys, manage alerts, generate reports |
| **Officer** | Edit indicators **in their own district only** |
| **Stakeholder** | Read-only + manage alert subscriptions + exports |
| **Public / anon** | Read-only dashboard |

Demo logins are available from the in-app login modal (real Supabase Auth users).

## Notes

- The advisor falls back to canned guidance when `GEMINI_API_KEY` is unset.
- Offline edits are queued locally and replay automatically on reconnect.
