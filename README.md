# LearnPath

A learning-roadmap platform that replaces chaotic study-group chats with a
linear, personal path. Each student gets a step-by-step roadmap where **exactly
one step is active at a time** (lesson → quiz → assignment); completing it
unlocks the next. Teachers author roadmap templates, grade assignments, and
answer questions. Armenian-first UI.

The full product specification is in [`SPEC.md`](./SPEC.md).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL + Prisma |
| Auth | JWT in an httpOnly cookie, bcrypt (cost 12) |
| Storage | Cloudflare R2 (S3-compatible) in prod; local disk in dev |
| i18n | next-intl (Armenian `hy` default, English `en`) |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Hosting | Vercel + Neon Postgres + Cloudflare R2 |

---

## Prerequisites

- **Node.js 20+** and npm
- A PostgreSQL database. For local dev you don't need to install Postgres — a
  helper script runs an embedded one (see below). For production, use
  [Neon](https://neon.tech).

---

## Local development

```bash
# 1. Install dependencies (also generates the Prisma client via postinstall)
npm install

# 2. Create your local env file
cp .env.example .env
#    The defaults work with the embedded dev database below. Set a real
#    JWT_SECRET even locally: openssl rand -base64 48

# 3. Start a local Postgres (embedded — no install needed) in a separate terminal.
#    Listens on localhost:5432 to match the default DATABASE_URL.
node scripts/dev-db.mjs

# 4. Apply migrations and seed demo data (1 teacher, 3 students, 2 subjects,
#    2 published Math templates with quizzes)
npm run prisma:migrate:deploy
npm run prisma:seed

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>. It redirects to `/hy` (Armenian).

Demo logins from the seed (all password `password123`):

| Role | Email |
|---|---|
| Teacher | `ani.hakobyan@learnpath.am` |
| Student | `davit.petrosyan@learnpath.am` (and `mariam.*`, `narek.*`) |

> Prefer your own Postgres or a Neon branch? Point `DATABASE_URL` at it and skip
> step 3.

---

## Environment variables

The app validates these on boot (see `src/lib/env.ts` + `src/instrumentation.ts`)
and **fails fast** with a clear message if a required one is missing or invalid.

| Variable | Required | What it's for | Where to get it |
|---|---|---|---|
| `DATABASE_URL` | Always | Postgres connection string | Neon dashboard → "Pooled connection" (append `?sslmode=require`). Local: the default in `.env.example`. |
| `JWT_SECRET` | Always (≥16 chars) | Signs session JWTs | Generate: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | Always | Base URL for signed download links | Local: `http://localhost:3000`. Prod: your Vercel URL. |
| `STORAGE_DRIVER` | Optional (default `local`) | `local` (disk) or `r2` (Cloudflare) | Set `r2` in production. |
| `LOCAL_STORAGE_PATH` | If `local` | Where uploads are written | Default `./storage`. |
| `R2_ACCOUNT_ID` | If `r2` | Cloudflare account id | Cloudflare dashboard → R2 → account id in the endpoint. |
| `R2_ACCESS_KEY_ID` | If `r2` | R2 API token key id | Cloudflare → R2 → Manage API Tokens → create token. |
| `R2_SECRET_ACCESS_KEY` | If `r2` | R2 API token secret | Same token creation screen (shown once). |
| `R2_BUCKET_NAME` | If `r2` | Bucket for materials/submissions | Cloudflare → R2 → create a bucket. |
| `R2_PUBLIC_URL` | Optional | Public bucket URL, if used | R2 bucket → public access settings. |
| `TEACHER_NAME` / `TEACHER_EMAIL` / `TEACHER_PASSWORD` | Only for prod seed | First teacher account created by `seed:production` | You choose them; used once. |

---

## Testing

```bash
# Unit + integration tests (Vitest). Spins up its own embedded Postgres,
# runs the real migrations, and tears it down. No setup needed.
npm test

# End-to-end tests (Playwright) covering SPEC.md §4's edge cases in the real UI.
# Uses its own embedded Postgres + a dev server on port 3100.
npx playwright install chromium   # one time
npm run test:e2e
```

---

## Deployment (Vercel + Neon + Cloudflare R2)

### 1. Database — Neon
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string → this is `DATABASE_URL`
   (ensure it ends with `?sslmode=require`).

### 2. Storage — Cloudflare R2
1. In the Cloudflare dashboard, enable **R2** and create a bucket → `R2_BUCKET_NAME`.
2. **R2 → Manage API Tokens → Create** an Object-Read-&-Write token →
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
3. Your account id (in the S3 endpoint `https://<id>.r2.cloudflarestorage.com`)
   → `R2_ACCOUNT_ID`.

### 3. App — Vercel
1. Import the repo in Vercel.
2. Set **Build Command** to `npm run vercel-build` (runs
   `prisma generate && prisma migrate deploy && next build` — migrations are
   applied automatically on each deploy; see the strategy below).
3. Add environment variables (Production scope): `DATABASE_URL`, `JWT_SECRET`,
   `NEXT_PUBLIC_APP_URL` (your Vercel URL), `STORAGE_DRIVER=r2`, and the four
   `R2_*` values.
4. Deploy. On boot the app validates the environment and will fail the deploy
   with a readable error if anything is missing.

### 4. Seed the first teacher (run once)
After the first successful deploy, create the initial teacher account and base
subjects against the production database:

```bash
TEACHER_NAME="Անուն Ազգանուն" \
TEACHER_EMAIL="teacher@yourschool.am" \
TEACHER_PASSWORD="a-strong-password" \
DATABASE_URL="<your-neon-url>" \
npm run seed:production
```

Then log in as that teacher and author roadmap templates in the teacher UI
(`/hy/teacher`). This script is idempotent and safe to re-run.

---

## Migration strategy (production)

- Migrations live in `prisma/migrations/` and are committed to the repo.
- Production applies them with **`prisma migrate deploy`** (never
  `migrate dev`) — it only applies already-generated migration files and never
  prompts or resets. This runs automatically as part of `vercel-build` on every
  deploy.
- To add a schema change: edit `prisma/schema.prisma`, run
  `npm run prisma:migrate` locally (creates a new migration + applies it to your
  dev DB), commit the generated migration folder, and deploy. Vercel applies it.
- The `20260822000000_init` migration includes three partial unique indexes that
  Prisma's schema DSL can't express (one active step per enrollment; one live
  enrollment per subject; one published template per subject+track). They are
  hand-written SQL in that migration — keep them when editing.

> **Note on `next build` under OneDrive:** building locally on a OneDrive-synced
> path (e.g. `C:\Users\...\OneDrive\...`) fails with an `EINVAL readlink` error —
> a Windows/OneDrive filesystem quirk, not a code issue. `next dev` and Vercel
> (Linux) builds are unaffected. To build locally, use a path outside OneDrive.

---

## Project structure

```
prisma/
  schema.prisma          # data model (SPEC.md §2)
  migrations/            # committed SQL migrations
  seed.ts                # dev/demo seed
  seed-production.ts     # one-time prod bootstrap (teacher + subjects)
src/
  app/[locale]/          # student + teacher UI (App Router)
  app/api/v1/            # REST API (SPEC.md §5)
  services/              # core logic (advanceStep, enrollment, grading, …)
  lib/                   # auth, jwt, prisma, storage, env, i18n helpers
  components/            # shared UI (student + teacher)
  instrumentation.ts     # env validation on boot
messages/                # hy.json (default) + en.json — all UI copy
tests/                   # vitest harness + Playwright e2e
scripts/dev-db.mjs       # embedded Postgres for local dev
```
