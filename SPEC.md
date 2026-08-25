# Learning Roadmap Platform — MVP Specification
**Ուսումնական Roadmap հարթակ — MVP բնութագիր**

> Working name: `LearnPath` (replace with real product name before launch).
> Version 1.0 — build spec for MVP. Every section below is implementation-ready.

---

## 0. Product in one paragraph

**EN:** Students currently study in Viber groups where lessons, files and assignments are mixed into one endless chat. There is no sense of direction, no visible progress, and no structure. LearnPath replaces that chat with a **linear roadmap**: after a short onboarding, each student receives a personal step-by-step path. Exactly one step is active at any time. A step is completed by watching/reading a lesson, passing a quiz, or submitting an assignment file. Completing a step unlocks the next one. The single active step is the product's core promise — **focus**.

**HY:** Աշակերտները հիմա սովորում են Viber խմբերում, որտեղ դասերը, ֆայլերը և առաջադրանքները խառնվում են մեկ անվերջ զրույցի մեջ։ Չկա ուղղություն, չկա տեսանելի առաջընթաց, չկա կառուցվածք։ LearnPath-ը փոխարինում է այդ զրույցը **գծային roadmap-ով**․ կարճ onboarding-ից հետո յուրաքանչյուր աշակերտ ստանում է իր անհատական քայլ առ քայլ ուղին։ Ցանկացած պահի ակտիվ է ուղիղ մեկ քայլ։ Քայլն ավարտվում է դաս դիտելով, թեստ հանձնելով կամ ֆայլ վերբեռնելով։ Ավարտված քայլը բացում է հաջորդը։ Մեկ ակտիվ քայլը՝ արտադրանքի հիմնական խոստումն է՝ **ֆոկուս**։

---

## 1. Users and roles

| Role | Can do |
|---|---|
| `student` | Register, complete onboarding, view own roadmap, open active step, take quizzes, upload assignments, download materials, ask mentor a question (if enabled) |
| `teacher` | Register (invite-only in MVP), create/edit roadmap templates, upload lesson materials, view submission queue, grade assignments, answer student questions |
| `admin` | Not in MVP. Teacher accounts are created manually in DB. |

**Out of scope for MVP:** payments, notifications/email, mobile app, chat, multiple simultaneous active steps, AI-generated content, student-to-student features.

---

## 2. Data model

PostgreSQL. All tables have `id` (uuid, pk), `created_at`, `updated_at` unless stated.

### 2.1 `users`
| Column | Type | Notes |
|---|---|---|
| name | text | not null |
| email | citext | unique, not null |
| password_hash | text | bcrypt, cost 12 |
| role | enum(`student`,`teacher`) | default `student` |
| locale | enum(`hy`,`en`) | default `hy` |

### 2.2 `subjects`
| Column | Type | Notes |
|---|---|---|
| title | text | e.g. "Մաթեմատիկա" |
| slug | text | unique |
| icon | text | nullable, icon key |
| is_active | bool | default true |

### 2.3 `roadmap_templates`
The reusable path a teacher authors once.

| Column | Type | Notes |
|---|---|---|
| subject_id | fk subjects | |
| track | enum(`exam`,`depth`) | answer to onboarding Q2 |
| title | text | |
| description | text | |
| author_id | fk users | must be role=teacher |
| is_published | bool | default false; only published templates can be enrolled into |

**Constraint:** unique(`subject_id`, `track`) among published templates. One published template per subject+track keeps enrollment deterministic.

### 2.4 `template_steps`
| Column | Type | Notes |
|---|---|---|
| template_id | fk roadmap_templates | on delete cascade |
| order_index | int | 1-based, unique within template |
| title | text | |
| description | text | lesson body / instructions, markdown |
| type | enum(`lesson`,`quiz`,`assignment`) | |
| pass_score | int | 0–100, only meaningful for `quiz`/`assignment`, default 60 |
| max_attempts | int | default 3, `null` = unlimited |
| estimated_minutes | int | used to compute due dates |

### 2.5 `step_materials`
Files attached by the teacher to a step (the "download" side).

| Column | Type | Notes |
|---|---|---|
| template_step_id | fk template_steps | |
| file_key | text | storage object key |
| file_name | text | original name |
| mime_type | text | |
| size_bytes | bigint | |
| uploaded_by | fk users | |

### 2.6 `questions`
| Column | Type | Notes |
|---|---|---|
| template_step_id | fk template_steps | step must be type=`quiz` |
| order_index | int | |
| text | text | |
| options | jsonb | array of strings, 2–6 items |
| correct_index | int | **never serialized to student clients** |
| explanation | text | shown after submit |

### 2.7 `enrollments`
One student starting one subject.

| Column | Type | Notes |
|---|---|---|
| user_id | fk users | |
| subject_id | fk subjects | |
| template_id | fk roadmap_templates | resolved at creation |
| track | enum(`exam`,`depth`) | copy of answer Q2 |
| pace | enum(`light`,`normal`,`intense`) | derived from answer Q3 |
| wants_mentor_qa | bool | answer Q4 |
| raw_answers | jsonb | full onboarding payload, for analytics |
| started_at | timestamptz | |
| completed_at | timestamptz | nullable |

**Constraint:** unique(`user_id`, `subject_id`) where `completed_at is null`. A student can't have two live enrollments in one subject.

### 2.8 `user_steps`
**The most important table.** The student's roadmap is literally a query on this.

| Column | Type | Notes |
|---|---|---|
| enrollment_id | fk enrollments | on delete cascade |
| template_step_id | fk template_steps | |
| order_index | int | denormalized copy, for cheap ordering |
| status | enum(`locked`,`active`,`done`) | default `locked` |
| score | int | nullable, 0–100 |
| attempts | int | default 0 |
| due_date | date | nullable |
| activated_at | timestamptz | nullable |
| completed_at | timestamptz | nullable |

**Constraints:**
- unique(`enrollment_id`, `template_step_id`)
- **At most one row per enrollment with status=`active`.** Enforce with a partial unique index:
  `CREATE UNIQUE INDEX ON user_steps (enrollment_id) WHERE status = 'active';`
  This makes the core product promise impossible to violate by accident.

### 2.9 `submissions`
| Column | Type | Notes |
|---|---|---|
| user_step_id | fk user_steps | |
| file_key | text | storage object key |
| file_name | text | |
| mime_type | text | |
| size_bytes | bigint | |
| submitted_at | timestamptz | |
| grade | int | nullable, 0–100 |
| feedback | text | nullable |
| graded_by | fk users | nullable |
| graded_at | timestamptz | nullable |

### 2.10 `quiz_attempts`
| Column | Type | Notes |
|---|---|---|
| user_step_id | fk user_steps | |
| attempt_number | int | |
| answers | jsonb | `[{question_id, chosen_index}]` |
| score | int | 0–100 |
| passed | bool | |

### 2.11 `mentor_questions`
| Column | Type | Notes |
|---|---|---|
| enrollment_id | fk enrollments | |
| user_step_id | fk user_steps | nullable, context |
| body | text | |
| answer | text | nullable |
| answered_by | fk users | nullable |
| answered_at | timestamptz | nullable |

---

## 3. Onboarding logic

Four questions, matching the PRD:

| # | Question (HY) | Stored as |
|---|---|---|
| 1 | Ընտրիր առարկան | `subject_id` |
| 2 | Ինչ է քեզ համար ամենակարևորը՝ քննության հանձնելը թե գիտելիքների խորացումը | `track` = `exam` \| `depth` |
| 3 | Օրական քանի ժամ ես պատրաստ հատկացնել պարապմունքներին | `pace` |
| 4 | Ունես ցանկություն արդյոք պարբերաբար տալ հարցեր քո ուսուցչին | `wants_mentor_qa` |

### Q3 → pace mapping
| Answer | pace | due-date spacing |
|---|---|---|
| < 1 hour | `light` | `estimated_minutes / 30` days, min 3 days per step |
| 1–2 hours | `normal` | `estimated_minutes / 60` days, min 2 days per step |
| 3+ hours | `intense` | `estimated_minutes / 120` days, min 1 day per step |

**Pace never changes which steps a student gets — only how far apart the due dates are.** This is deliberate: it keeps content authoring to two templates per subject instead of six.

### Enrollment creation (transactional)
```
BEGIN
  template := SELECT * FROM roadmap_templates
              WHERE subject_id = $1 AND track = $2 AND is_published = true
  IF NOT FOUND → 422 NO_TEMPLATE_AVAILABLE
  enrollment := INSERT INTO enrollments (...)
  FOR EACH template_step ORDER BY order_index:
      INSERT INTO user_steps (
        enrollment_id, template_step_id, order_index,
        status = (order_index = 1 ? 'active' : 'locked'),
        due_date = start + cumulative_spacing(pace, estimated_minutes),
        activated_at = (order_index = 1 ? now() : null)
      )
COMMIT
```
Never create an enrollment without its steps. A half-created roadmap is worse than a failed signup.

---

## 4. Status state machine

```
        ┌──────────┐  previous step becomes done   ┌──────────┐
        │  locked  │ ────────────────────────────► │  active  │
        └──────────┘                               └──────────┘
                                                        │
                        completion condition met        │
                                                        ▼
                                                   ┌──────────┐
                                                   │   done   │
                                                   └──────────┘
```

### Completion condition per step type
| type | becomes `done` when |
|---|---|
| `lesson` | student calls "mark as viewed" |
| `quiz` | latest attempt `score >= pass_score` |
| `assignment` | submission exists AND (`pass_score = 0` OR `grade >= pass_score`) |

### `advanceStep(user_step_id)` — single source of truth
All three completion paths call **one** service function. Do not duplicate this logic in controllers.

```
advanceStep(userStepId):
  step := lock row FOR UPDATE
  IF step.status != 'active' → throw STEP_NOT_ACTIVE
  step.status = 'done'; step.completed_at = now()
  next := SELECT * FROM user_steps
          WHERE enrollment_id = step.enrollment_id
            AND order_index = step.order_index + 1
  IF next EXISTS:
      next.status = 'active'; next.activated_at = now()
  ELSE:
      enrollment.completed_at = now()
  RETURN { completed: step, next: next|null, enrollment_finished: bool }
```
Run inside a transaction with `SELECT ... FOR UPDATE` so two concurrent requests can't unlock two steps.

### Edge cases (required behaviour)
| Situation | Behaviour |
|---|---|
| Quiz failed | Step stays `active`. `attempts += 1`. Show which questions were wrong + explanations. Retry allowed immediately. |
| Attempts exhausted (`attempts >= max_attempts`) | Step stays `active`. Quiz submit returns `NO_ATTEMPTS_LEFT`. Lesson materials re-surfaced. If `wants_mentor_qa`, prompt to ask mentor. Teacher sees the student in a "stuck" list. **Never hard-lock the student out.** |
| `due_date` passed | Step stays `active`, response includes `overdue: true`. UI shows a soft warning. No auto-locking — locking a struggling student out is how you lose them. |
| Assignment ungraded | Step stays `active` with sub-state `awaiting_review` in the API response. Student sees "Ուղարկված է, սպասում է ստուգման". |
| Assignment graded below pass | Step stays `active`, feedback shown, student may re-upload (old submission kept, new row inserted). |
| Student opens a `locked` step | 403 `STEP_LOCKED`. |

---

## 5. API

Base: `/api/v1`. JSON. Auth via `Authorization: Bearer <jwt>`. JWT claims: `sub`, `role`, `exp` (7 days).

### 5.1 Error format
```json
{ "error": { "code": "STEP_LOCKED", "message": "Step is not yet unlocked" } }
```
API messages are English and language-neutral; the client maps `code` → Armenian string. Codes used:
`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`STEP_LOCKED`, `STEP_NOT_ACTIVE`, `WRONG_STEP_TYPE`, `NO_ATTEMPTS_LEFT`,
`NO_TEMPLATE_AVAILABLE`, `ALREADY_ENROLLED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`,
`VALIDATION_ERROR`.

### 5.2 Auth
```
POST /auth/register   {name,email,password,role?} → 201 {token, user}
POST /auth/login      {email,password}            → 200 {token, user}
GET  /me                                          → 200 {user, enrollments:[...]}
```

### 5.3 Onboarding
```
GET  /subjects → 200 {subjects:[{id,title,slug,icon}]}

POST /enrollments
  { subject_id, track:"exam"|"depth",
    daily_hours:"lt1"|"1to2"|"gt3", wants_mentor_qa: bool }
  → 201 {
      enrollment: {id, subject:{...}, track, pace, started_at, total_steps},
      active_step: {id, title, type, order_index, due_date}
    }
```

### 5.4 Roadmap
```
GET /enrollments/:id/roadmap → 200 {
  enrollment: {id, subject, track, pace, completed_at},
  progress: {done, total, percent, active_step_id},
  steps: [{
    id, order_index, title, type, status,
    score, attempts, max_attempts,
    due_date, overdue, awaiting_review
  }]
}
```
`percent` is computed server-side (`done / total * 100`, rounded) so the progress bar can never disagree between devices.

```
GET /steps/:id → 200 {
  id, title, description, type, status, order_index,
  pass_score, attempts, max_attempts, due_date, overdue,
  materials: [{id, file_name, size_bytes, download_url}],
  submission: {...}|null
}
403 STEP_LOCKED if status = locked
```

### 5.5 Completion
```
POST /steps/:id/view
  precondition: type=lesson, status=active
  → 200 {step:{...done}, next_step:{...}|null, enrollment_finished:bool}

GET  /steps/:id/quiz
  → 200 {questions:[{id, order_index, text, options}], pass_score, attempts, max_attempts}
  correct_index is NEVER included.

POST /steps/:id/quiz/submit
  {answers:[{question_id, chosen_index}]}
  → 200 {
      score, passed, attempts, attempts_left,
      results:[{question_id, correct, correct_index, explanation}],
      next_step:{...}|null, enrollment_finished:bool
    }
  409 NO_ATTEMPTS_LEFT
```
`correct_index` appears only in the **response to a submitted attempt**, never before.

### 5.6 Files
```
POST   /steps/:id/submissions   multipart/form-data, field "file"
       → 201 {submission:{id,file_name,submitted_at}, step:{...}}
GET    /submissions/:id/file    → 302 redirect to signed URL (15 min TTL)
GET    /materials/:id/file      → 302 redirect to signed URL (15 min TTL)
DELETE /submissions/:id         → 204 (only while grade IS NULL, only own)
```
**Upload rules (enforce server-side, never trust the client):**
max 10 MB; allowed `application/pdf`, `image/png`, `image/jpeg`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`.
Store in S3-compatible storage (AWS S3 / Cloudflare R2). DB stores only `file_key`.

### 5.7 Mentor Q&A
```
POST /enrollments/:id/questions  {body, user_step_id?} → 201
GET  /enrollments/:id/questions  → 200 {questions:[...]}
```
Only if `enrollment.wants_mentor_qa = true`, else 403 `FORBIDDEN`.

### 5.8 Teacher
```
GET  /teacher/templates
POST /teacher/templates              {subject_id, track, title, description}
POST /teacher/templates/:id/publish
POST /teacher/templates/:id/steps    {order_index,title,description,type,pass_score,max_attempts,estimated_minutes}
POST /teacher/steps/:id/materials    multipart
POST /teacher/steps/:id/questions    {text, options[], correct_index, explanation}

GET  /teacher/submissions?status=pending  → grading queue
POST /teacher/submissions/:id/grade  {grade, feedback}
     → if grade >= pass_score, calls advanceStep()

GET  /teacher/students/stuck   → enrollments whose active step has attempts >= max_attempts
POST /teacher/questions/:id/answer  {answer}
```

---

## 6. Screens

### Student
| Screen | Contents |
|---|---|
| **Landing** | Logged-out marketing page (LearnKata-style): sticky blur header, serif hero + blue CTAs, numbered 5-step learning-path explainer, feature cards, footer. Logged-in visitors are routed onward. |
| **Register / Login** | Name, email, password, role picker (student/teacher), password reveal. Desktop split-panel / mobile single column. Armenian labels. |
| **Onboarding 1–4** | One question per screen, progress dots, back button. Q1 = subject cards. Q2 = two large choice cards. Q3 = three options. Q4 = yes/no. |
| **Dashboard** | Progress bar (`percent`), active step card (big, primary CTA), vertical roadmap list below. |
| **Roadmap list item** | Number, title, type icon, status pill: `locked` (grey, lock icon), `active` (green, glowing), `done` (checkmark). Locked items are non-tappable and visually muted. |
| **Step detail — lesson** | Title, markdown body, downloadable materials list, "Ավարտված է" button. |
| **Step detail — quiz** | Question-by-question, one at a time, submit at end. Result screen: score, pass/fail, per-question correctness + explanation, retry or continue. |
| **Step detail — assignment** | Instructions, materials to download, file picker, upload state, submitted state ("սպասում է ստուգման"), grade + feedback when returned. |
| **Mentor Q&A** | Simple list of asked questions and answers, plus input. Only if enabled. |
| **Completion** | Shown when `enrollment_finished` — summary of all steps and scores. |

### Teacher
| Screen | Contents |
|---|---|
| **Template editor** | Template meta, drag-orderable step list, per-step form. |
| **Question editor** | Add/edit quiz questions with options and correct answer. |
| **Grading queue** | Pending submissions, download file, grade + feedback form. |
| **Stuck students** | Students blocked on a step, with attempt counts. |
| **Questions inbox** | Unanswered mentor questions. |

---

## 7. Tech stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Front-end | Next.js (App Router) + TypeScript + Tailwind v4 (CSS-based config, no `tailwind.config.js`) + shadcn/ui + framer-motion | one repo, SSR, easy deploy; design system in `globals.css` (§12) |
| Fonts | Noto Serif Armenian (headings) + Noto Sans Armenian / Inter (body), self-hosted via `next/font` | serif+sans pairing, Armenian-capable, no runtime fetch |
| Back-end | Next.js route handlers (or separate Express if preferred) | fewer moving parts for MVP |
| DB | PostgreSQL + Prisma | partial unique index support needed for the one-active-step rule |
| Auth | JWT in httpOnly cookie, bcrypt | no third-party dependency |
| Storage | Cloudflare R2 or AWS S3, signed URLs | never serve files from the app server |
| Hosting | Vercel + Neon/Supabase Postgres | free tier is enough for beta |
| i18n | `next-intl`, Armenian default | all UI strings in `messages/hy.json` from day one |

---

## 8. Build order

1. Project setup, Prisma schema, migrations, seed script (1 subject, 2 templates, ~8 steps, 10 questions)
2. Auth (register, login, `/me`, JWT middleware)
3. `advanceStep` service + unit tests — **before any UI**
4. Onboarding endpoints + enrollment creation
5. Roadmap + step detail endpoints
6. Quiz endpoints
7. File upload/download + submissions
8. Teacher endpoints
9. Front-end: auth screens → onboarding → dashboard/roadmap → step details
10. Teacher UI
11. QA pass over the edge-case table in §4
12. Deploy + seed real content

---

## 9. Beta success criteria

Deploy to one existing Viber study group. Measure over 3 weeks:

| Metric | Target | Meaning |
|---|---|---|
| Onboarding completion | ≥ 80% | the 4 questions aren't too heavy |
| First step done within 7 days | ≥ 60% | the roadmap actually starts people |
| Week-2 return rate | ≥ 50% | the loop holds |
| Median steps completed | ≥ 4 | real progress, not a single visit |
| Assignment submission rate | ≥ 50% | file flow works and is used |
| Viber group message volume | decreasing | the product is replacing the chat |

Qualitative check (5 short interviews): *"Do you know what you should be doing right now?"* — if beta students can answer that instantly and couldn't before, the core hypothesis holds.

---

## 10. Deliberately deferred

Payments · notifications/reminders · mobile app · AI-generated roadmaps · video hosting · multiple active steps · student chat · certificates · analytics dashboard for teachers · admin panel.

Add only after the beta metrics above are met.

---

## 11. Post-MVP: production hardening & scale

Added after the MVP shipped, to make the product production-ready at scale. These
are **implemented**, not deferred.

### 11.1 Login rate-limiting / brute-force protection

Authentication endpoints are the primary brute-force surface. Enforce a fixed
window limiter:

| Endpoint | Key | Limit | Window |
|---|---|---|---|
| `POST /auth/login` | client IP + email | 5 attempts | 15 minutes |
| `POST /auth/register` | client IP | 10 attempts | 60 minutes |

- On exceed → `429` with error code `RATE_LIMITED`.
- The limiter lives behind a **`RateLimitStore` interface** (like the storage
  driver). The default `MemoryRateLimitStore` is correct for a single instance.
  **At scale (multiple serverless instances) it MUST be swapped for a shared
  store** (Upstash Redis / `@upstash/ratelimit`) — an in-memory counter is
  per-instance and therefore only a soft limit behind a load balancer. This is
  the one scale caveat to close before high traffic.
- Client IP is read from `x-forwarded-for` (Vercel sets it), falling back to a
  constant so the limiter still functions locally.
- Limits are overridable via env (`RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`)
  so tests and staging can relax them.

### 11.2 Structured logging & observability

- All server-side logging goes through a single **Pino** logger
  (`src/lib/logger.ts`) — structured JSON to stdout, which Vercel captures.
- Levels: `info` (normal lifecycle), `warn` (handled/expected problems, e.g. a
  rate-limit trip), `error` (unexpected failures). Controlled by `LOG_LEVEL`
  (default `info`; `debug`/`silent` available).
- **No bare `console.*` in server code.** The central error handler logs every
  unexpected 500 with the error object and request context (method + path).
- Each log line carries context metadata (`{ method, path, code }`) so failures
  are traceable without a full APM. A hosted APM (Sentry/Datadog) can subscribe
  to the same stream later without code changes.

### 11.3 Enhanced teacher controls

Beyond authoring and grading, teachers get override controls to unblock students:

- **Reset attempts** — `POST /teacher/user-steps/:id/reset-attempts`. Sets a
  student's active step `attempts` back to 0 so a student who exhausted their
  quiz attempts (and appears in the "stuck" list, §4) can try again. Only valid
  on an `active` step; never changes `status` (the one-active-step rule is
  untouched). Surfaced as a button on the stuck-students screen.

### 11.4 Real Cloudflare R2 file management

The storage layer (§5.6) already abstracts R2 behind `StorageDriver`. Production
requirements for the R2 driver:

- **Bucket is private.** Files are never public; access is always via a
  15-minute pre-signed GET URL.
- **Key structure**: `submissions/{userStepId}/{uuid}-{filename}` and
  `materials/{templateStepId}/{uuid}-{filename}`. The UUID prevents collisions
  and guessing.
- **Safe downloads**: pre-signed URLs set `ResponseContentDisposition: attachment`
  so a browser downloads rather than renders an uploaded file inline (defence in
  depth alongside content sniffing).
- **Cleanup**: deleting a submission (only while ungraded) deletes its R2 object
  in the same operation — no orphaned blobs.
- **Config** is validated on boot: when `STORAGE_DRIVER=r2`, the four `R2_*`
  variables are required (§7 env validation), so a misconfigured deploy fails
  fast rather than at first upload.

---

## 12. LearnKata-inspired Design System

The UI/UX overhaul to a premium, [LearnKata](https://learnkata.ai/)-style aesthetic
is **in scope** for the product. The whole app (student + teacher, light + dark)
renders on a single set of CSS custom properties defined in `src/app/globals.css`
(there is no `tailwind.config.js` — Tailwind v4 keeps its theme in CSS `@theme inline`).

### 12.1 Color

Neutrals are **pure gray** (0% saturation), not cool-slate. Brand is **blue**.
Status colors are semantic and retuned to sit on the lighter surfaces.

| Token | Light | Role |
|---|---|---|
| `--bg` | `#fcfcfc` | app background |
| `--surface` | `#ffffff` | cards / panels |
| `--surface-muted` | `#f5f5f5` | tinted sections, chips |
| `--border` | `#e5e5e5` | hairlines |
| `--text` / `--text-muted` | `#0a0a0a` / `#737373` | body text |
| `--accent` / `--accent-hover` | `#2563eb` / `#1d4ed8` | brand blue, **active step**, primary CTA |
| `--accent-soft` / `--accent-text` | `#eff6ff` / `#1d4ed8` | soft blue chips, eyebrow labels |
| `--success*` | emerald `#059669` | **completed** steps |
| `--warning*` | amber `#d97706` | **overdue** alerts |
| `--danger*` | red `#dc2626` | errors / failures |

Dark mode re-values the same tokens to a neutral-gray dark (`--bg #0a0a0a`,
`--surface #171717`, brighter blue `#3b82f6`).

### 12.2 Typography

**Serif display headings + hyperlegible sans body** — the LearnKata editorial
pairing, adapted to Armenian (Young Serif / Atkinson Hyperlegible have no Armenian
glyphs):

- **Headings** (`h1–h3`, hero, section titles): **Noto Serif Armenian** via
  `--font-serif`, applied app-wide (override with the `font-sans` utility for
  numeric/label chrome).
- **Body**: **Noto Sans Armenian** (+ Inter for Latin/numerals) via `--font-sans`.
- **Eyebrow labels**: uppercase, 12px, 600 weight, letter-spacing, blue-700 —
  the `Eyebrow` primitive (`src/components/ui.tsx`), used as section/step kickers.

### 12.3 Shape, shadow, motion

- **Radius**: base `--radius` = `0.5rem`; buttons `rounded-lg` (8px); cards
  `rounded-2xl` (16px); hero surfaces `rounded-3xl` (24px); badges are pills.
- **Shadows**: soft, layered, low-opacity tokens `--shadow-sm/md/lg`, plus a
  blue `--shadow-primary` and `--shadow-glow` for primary actions and the active
  step's breathing `.active-glow`.
- **Motion** (framer-motion): entrance fades/slides, staggered lists,
  `whileHover` elevation, `whileInView` reveals on the landing page. All motion
  respects `prefers-reduced-motion`.

### 12.4 The numbered learning-path

The roadmap is presented in LearnKata's **numbered step** language: a prominent
serif numeral + blue eyebrow label + title + description. The active step is the
blue hero card (blue glow + primary CTA); completed = emerald check; overdue =
amber badge; locked = dimmed, non-interactive, lock icon. Reusable primitives:
`Eyebrow`, `StepNumber` (`src/components/ui.tsx`).