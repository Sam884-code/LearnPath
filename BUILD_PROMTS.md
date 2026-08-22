# Build Prompts — paste these into Claude Code / Cursor, in order

## How to use this file

1. Create an empty folder, open it in Cursor or run `claude` in it.
2. Put `SPEC.md` in the root of that folder. **Every prompt below assumes the tool can read `SPEC.md`.**
3. Paste prompts one at a time. Wait for each to finish and verify the checkpoint before moving on.
4. If something breaks, don't paste the next prompt — use the *Recovery prompts* at the bottom.

Rule of thumb: **one prompt = one thing that can be tested.** If a prompt produces 40 files and you can't tell whether it worked, it was too big.

---

## Prompt 0 — Orientation

```
Read SPEC.md in full before writing any code. It is the complete specification
for this project.

Then, without writing code yet, answer:
1. A one-paragraph summary of what we're building.
2. The 5 decisions in the spec you think are most likely to cause bugs if
   implemented carelessly.
3. Any place where the spec is ambiguous or self-contradictory. List them —
   do not silently guess.

Wait for my answers to your questions before starting Prompt 1.

```
**Checkpoint:** it correctly names the one-active-step rule and `advanceStep` as critical. If it doesn't, the spec wasn't read — repeat.

---

## Prompt 1 — Scaffold and schema

```
Set up the project per SPEC.md §7:
- Next.js 14+ App Router, TypeScript, Tailwind
- Prisma + PostgreSQL
- next-intl with Armenian ("hy") as the default locale, English ("en") second

Write prisma/schema.prisma implementing every table in SPEC.md §2 exactly:
all columns, types, enums, foreign keys and constraints.

Critical: implement the partial unique index from §2.8 that allows at most one
user_step with status='active' per enrollment. Prisma can't express this in the
schema DSL — add it as a raw SQL migration.

Also create .env.example with every variable the project needs.

Do not build any API routes or UI yet.
```
**Checkpoint:** `npx prisma migrate dev` runs clean, and the partial unique index exists in the migration SQL.

---

## Prompt 2 — Seed data

```
Write prisma/seed.ts creating realistic Armenian test data:
- 1 teacher, 3 students
- 2 subjects (Մաթեմատիկա, Ֆիզիկա)
- For Մաթեմատիկա: both templates (track "exam" and track "depth"), published
- The "exam" template: 8 steps mixing lesson / quiz / assignment types,
  with realistic Armenian titles and descriptions
- 2 of the quiz steps get 5 questions each, 4 options, with explanations
- Leave students unenrolled — enrollment must go through the real API

Make it idempotent so I can re-run it.
```
**Checkpoint:** `npx prisma db seed` runs twice with no duplicate-key errors.

---

## Prompt 3 — Auth

```
Implement SPEC.md §5.2:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- GET  /api/v1/me

bcrypt cost 12. JWT with sub/role/exp, 7-day expiry, set as an httpOnly cookie
AND returned in the body.

Write a requireAuth() helper and a requireRole('teacher') helper that all later
routes will use.

Use the exact error format and error codes from SPEC.md §5.1.

Add a request-validation layer (zod) — every endpoint validates its body and
returns VALIDATION_ERROR on failure.
```
**Checkpoint:** register → login → `/me` works via curl; a bad password returns `INVALID_CREDENTIALS`, not a 500.

---

## Prompt 4 — advanceStep (the important one)

```
Implement the advanceStep() service exactly as specified in SPEC.md §4.

Requirements:
- Lives in one file, e.g. src/services/advanceStep.ts
- Runs in a transaction with SELECT ... FOR UPDATE on the user_step row
- Throws STEP_NOT_ACTIVE if the step isn't active
- Marks the step done, activates the next by order_index, and sets
  enrollment.completed_at when there is no next step
- Returns { completed, next, enrollment_finished }

Then write unit tests (vitest) covering:
1. Normal advance: step 1 done → step 2 active
2. Last step: enrollment gets completed_at, no next step
3. Advancing a locked step throws STEP_NOT_ACTIVE
4. Advancing an already-done step throws STEP_NOT_ACTIVE
5. Two concurrent advanceStep calls on the same step: exactly one succeeds,
   and the enrollment still has exactly one active step afterwards

Test 5 is the one that matters. Make it actually run concurrent transactions.
```
**Checkpoint:** all 5 tests pass, especially #5. **Do not continue until they do.** Every later feature depends on this being correct.

---

## Prompt 5 — Onboarding and enrollment

```
Implement SPEC.md §5.3 and §3:
- GET  /api/v1/subjects
- POST /api/v1/enrollments

The enrollment endpoint must:
- Map daily_hours to pace using the table in §3
- Resolve the published template by (subject_id, track), returning
  NO_TEMPLATE_AVAILABLE (422) if none exists
- Create the enrollment and ALL user_steps in ONE transaction
- Set order_index 1 to active with activated_at, everything else locked
- Compute due_date per step using the pace spacing rules in §3
- Return ALREADY_ENROLLED if the student has a live enrollment in that subject

Store the full onboarding payload in raw_answers.

Write an integration test: enroll a seeded student, then assert the DB has the
right number of user_steps, exactly one active, correct due-date spacing.
```
**Checkpoint:** enrolling twice in the same subject returns `ALREADY_ENROLLED`.

---

## Prompt 6 — Roadmap and step detail

```
Implement SPEC.md §5.4:
- GET /api/v1/enrollments/:id/roadmap
- GET /api/v1/steps/:id

Rules:
- progress.percent computed server-side, rounded
- overdue = due_date < today AND status != 'done'
- awaiting_review = assignment with a submission whose grade IS NULL
- Locked steps return 403 STEP_LOCKED from the detail endpoint
- Students can only read their own enrollments — a student reading another
  student's roadmap gets 403 FORBIDDEN. Write a test for this specifically.
```
**Checkpoint:** student A cannot read student B's roadmap.

---

## Prompt 7 — Lessons and quizzes

```
Implement SPEC.md §5.5:
- POST /api/v1/steps/:id/view       (lesson only, calls advanceStep)
- GET  /api/v1/steps/:id/quiz
- POST /api/v1/steps/:id/quiz/submit

Absolute requirement: GET quiz NEVER includes correct_index in the response.
correct_index appears only in the submit response. Write a test asserting the
GET response body does not contain the string "correct_index".

Submit logic:
- Increment attempts, record a quiz_attempts row
- score = round(correct / total * 100)
- passed = score >= pass_score
- If passed, call advanceStep and include next_step
- If not passed, step stays active; return per-question results + explanations
- If attempts >= max_attempts (and max_attempts is not null),
  return 409 NO_ATTEMPTS_LEFT and do NOT record an attempt
- Wrong step type returns WRONG_STEP_TYPE

Cover every edge case from the table in SPEC.md §4 with a test.
```
**Checkpoint:** failing a quiz leaves the step active and the next step locked.

---

## Prompt 8 — Files

```
Implement SPEC.md §5.6 with S3-compatible storage (use Cloudflare R2 config,
but keep the storage layer behind an interface so it can be swapped).

- POST   /api/v1/steps/:id/submissions   (multipart, field "file")
- GET    /api/v1/submissions/:id/file    (302 to signed URL, 15 min)
- GET    /api/v1/materials/:id/file      (302 to signed URL, 15 min)
- DELETE /api/v1/submissions/:id         (only own, only while grade IS NULL)

Enforce server-side, never trusting client headers:
- 10 MB max → FILE_TOO_LARGE
- allowed MIME types from §5.6 → UNSUPPORTED_FILE_TYPE
- sniff the actual file content, don't trust the declared mime type

Assignment steps with pass_score = 0 advance immediately on upload.
Steps with pass_score > 0 stay active in awaiting_review until graded.

Also add a local-filesystem storage driver behind the same interface so the
project can run without cloud credentials in development.
```
**Checkpoint:** upload works locally with no R2 account; an 11 MB file is rejected.

---

## Prompt 9 — Teacher endpoints

```
Implement SPEC.md §5.8 and §5.7. All teacher routes go through
requireRole('teacher').

Grading: POST /teacher/submissions/:id/grade must call advanceStep() when
grade >= the step's pass_score — reuse the service, do not reimplement the
transition.

Mentor Q&A: the student endpoints return 403 FORBIDDEN when the enrollment
has wants_mentor_qa = false. Test that.

Templates can only be published if they have at least one step, and every
quiz step has at least one question. Otherwise return VALIDATION_ERROR.
```
**Checkpoint:** grading an assignment above pass score unlocks the next step for the student.

---

## Prompt 10 — Front-end: auth and onboarding

```
Build the student auth and onboarding UI per SPEC.md §6.

- All user-facing text in Armenian, via next-intl. No hardcoded strings —
  everything goes in messages/hy.json.
- Onboarding is 4 screens, one question each, with progress dots and a back
  button. State is held client-side until the final screen, then submitted
  as ONE call to POST /enrollments.
- Q1 subject cards, Q2 two large choice cards, Q3 three options, Q4 yes/no.
- Map API error codes to Armenian messages in one central file.
- Mobile-first. Most students will be on phones.

Design direction: calm and focused, not gamified-childish. One clear action
per screen. Generous spacing. This product's whole promise is focus — the UI
should feel like relief from a chaotic Viber group.
```
**Checkpoint:** a fresh signup reaches the dashboard with a real roadmap.

---

## Prompt 11 — Front-end: dashboard and roadmap

```
Build the dashboard per SPEC.md §6.

- Progress bar using progress.percent from the API (never recompute client-side)
- Active step as a large prominent card with the primary CTA — it should be
  obvious within one second what to do next
- Vertical roadmap list below: number, title, type icon, status pill
- Locked steps: muted, lock icon, not tappable, no navigation on click
- Done steps: checkmark, score if it was a quiz
- Overdue active step: soft warning styling, never blocking
- Loading skeletons, and an empty state if somehow no enrollment exists
```
**Checkpoint:** tapping a locked step does nothing; tapping the active step opens it.

---

## Prompt 12 — Front-end: step details

```
Build the three step-detail screens per SPEC.md §6.

Lesson: markdown body, materials with download buttons, "Ավարտված է" button.

Quiz: one question per screen, back/next, review before submit. Result screen
shows score, pass/fail, each question's correctness with explanation, then
either "Կրկնել" (retry) or "Շարունակել" (continue to next step). When
NO_ATTEMPTS_LEFT, show the lesson materials again and, if the enrollment has
wants_mentor_qa, a prompt to ask the mentor.

Assignment: instructions, materials, file picker with client-side size/type
pre-check (server still validates), upload progress, submitted state
"Ուղարկված է, սպասում է ստուգման", and grade + feedback when returned with
the option to re-upload if below pass score.

When a step completes and the next unlocks, show a brief confirmation and
navigate back to the dashboard so the newly active step is visible.
```
**Checkpoint:** full loop works — dashboard → step → complete → next unlocked → dashboard.

---

## Prompt 13 — Teacher UI

```
Build the teacher screens per SPEC.md §6: template editor with orderable
steps, question editor, grading queue with file download and grade+feedback
form, stuck-students list, and the questions inbox.

Teacher UI can be desktop-first and plainer than the student UI — teachers
will use laptops.
```

---

## Prompt 14 — QA pass

```
Go through the edge-case table in SPEC.md §4 and the beta criteria in §9.

For each row of the edge-case table, write an end-to-end test (Playwright)
proving the behaviour is correct in the real UI, not just the API.

Then audit the codebase and report:
1. Any place that changes user_step.status WITHOUT going through advanceStep()
2. Any endpoint missing an ownership check
3. Any hardcoded user-facing string not in messages/hy.json
4. Any place correct_index could reach a student client

Fix what you find.
```
**Checkpoint:** answer to #1 should be "none."

---

## Prompt 15 — Deploy

```
Prepare for deployment to Vercel + Neon Postgres + Cloudflare R2.

- Production-ready next.config, env validation on boot (fail fast if a
  required variable is missing)
- Migration strategy for production
- A README with exact setup steps for someone who has never seen this repo
- A seeding script for real content that a teacher can run once

List every environment variable I need to set, what it's for, and where I get it.
```

---

## Recovery prompts

**When something is broken:**
```
[paste the exact error]

Diagnose the root cause before changing anything. Tell me what's wrong and
why, then fix only that. Do not refactor unrelated code.
```

**When it built the wrong thing:**
```
That doesn't match SPEC.md §[X]. Re-read that section and list the specific
differences between the spec and what you built. Then fix them.
```

**When you're lost:**
```
Summarize the current state of this project: what's built, what's tested,
what's left per SPEC.md §8. Be honest about what's incomplete or stubbed.
```

**When it wants to add things you didn't ask for:**
```
Stick to the MVP scope in SPEC.md §10. Do not add features that aren't in the
spec. If you think something is missing, tell me instead of building it.
```

---

## Two habits that will save you

**Commit after every green checkpoint.** `git add -A && git commit -m "prompt N"`. When prompt 9 breaks something from prompt 4, you'll want to go back.

**Never paste the next prompt while something is red.** Broken foundations compound, and by prompt 12 you won't be able to tell which layer is at fault.