# Technician Dispatch Planner — Implementation Plan

## 0. Source data contract (already fixed by the input file)

File: `P11_route_shift_public.json`. Top level has `schema_version`, `problem_id`, `format_note`, and `cases: []` — **25 independent cases**, each a full standalone day (own areas, travel matrix, technicians, jobs, one `manual_move`). The app must let the user pick which case to load, not assume a single case.

Per case:
```ts
type Case = {
  case_id: string;
  today: string;                 // "YYYY-MM-DD"
  areas: string[];
  travel_minutes: Record<string, Record<string, number>>; // symmetric, travel_minutes[A][A] = 0
  technicians: Technician[];
  jobs: Job[];
  manual_move: { job_id: string; to_technician: string }; // scripted trigger for requirement 4
};

type Technician = {
  id: string; name: string;
  skills: string[];              // observed vocabulary: "ac" | "plumbing" | "electrical" | "gas_line"
  shift_start: string; shift_end: string; // "HH:MM"
  home_area: string;
};

type Job = {
  id: string; area: string; skill: string;
  duration_minutes: number;
  window_start: string; window_end: string; // "HH:MM", customer-promised window
};
```
No return-to-home leg is required at end of shift. Travel table is authoritative — never estimate travel from coordinates.

`manual_move` is important: it's the built-in test for required item 4. The app should be able to take that exact `{job_id, to_technician}` and run it through the validity check, whether or not the job was auto-assigned to that tech.

---

## 1. Stack & structure

- **Next.js (App Router) + TypeScript**, client-heavy (no real backend needed — everything runs on the uploaded JSON in memory). Use a couple of Route Handlers only if you want the algorithm to run server-side for large cases; otherwise pure client-side is simpler and fine at this scale (≤16 techs, ≤40 jobs).
- Keep the **scheduling engine framework-agnostic**: a plain `lib/engine/` folder of pure TypeScript functions with zero React/Next imports. This is the part with real logic and the part you'll unit-test; UI just calls it. Do not let engine code import from `components/`.

```
/lib/engine/
  types.ts            # Case, Technician, Job, Assignment, TimelineEntry, UnassignedEntry
  time.ts             # "HH:MM" <-> minutes-since-midnight helpers
  travel.ts           # travel(areaA, areaB, matrix) lookup with validation
  feasibility.ts       # canInsert(job, tech, route, matrix) -> {ok, reason?, insertAt?}
  assign.ts           # buildPlan(case) -> {routes, unassigned}  (greedy insertion engine)
  manualMove.ts       # applyManualMove(plan, jobId, toTechId, case) -> {ok, reason?, newPlan?}
  score.ts            # scorePlan(plan) -> {assignedCount, totalTravelMinutes, ...}  (bonus)
/app/
  page.tsx            # upload + case picker
  planner/page.tsx    # main view: timelines + unassigned list
/components/
  UploadDropzone.tsx
  CaseSelector.tsx
  TechnicianTimeline.tsx
  UnassignedList.tsx
  ManualMoveControl.tsx
  PlanScoreBadge.tsx  # bonus
/lib/engine/__tests__/ # feasibility.test.ts, assign.test.ts — test against the actual 25 cases
```

---

## 2. Phased build order

Build and verify each phase before moving to the next; each is independently demoable.

### Phase 1 — Ingest
- File upload (drag/drop or `<input type=file>`), `JSON.parse`, validate against the `Case[]` shape (zod schema recommended — reject with a clear message if a field is missing).
- **No hardcoded sizes anywhere in engine or UI.** The bundled file has 25 cases with 12–16 technicians and 30–40 jobs each, but that's just this sample — validation must check *types/required keys only* (no `.length()`/count assertions on `cases`, `technicians`, `jobs`, or `areas`), and no loop, layout, or test may assume a fixed count. Skill strings (`ac`, `plumbing`, `electrical`, `gas_line` in this sample) must be treated as an open, data-driven set — never enumerated in a switch/if-chain.
- Case selector dropdown populated from `cases[].case_id`.
- Store parsed case in React state (a small Zustand store or just `useState` lifted to a layout — no need for anything heavier at this scale).
- **Done when:** picking a case shows raw technician/job counts on screen.

### Phase 2 — Engine primitives
- `time.ts`: `hhmmToMinutes`, `minutesToHhmm`.
- `travel.ts`: `getTravel(matrix, from, to)`; throw a descriptive error if an area is missing from the matrix (fail loud, this indicates bad input, not a rule violation).
- `feasibility.ts` — the single function everything else depends on:
  ```ts
  function canInsert(job, tech, currentRoute, travelMatrix, shiftBounds):
    { ok: true, insertIndex, arrival, start, end } |
    { ok: false, reason: 'SKILL_MISMATCH' | 'OUTSIDE_SHIFT' | 'WINDOW_UNREACHABLE' | 'BUMPS_LATER_JOB' }
  ```
  Logic: skill check first (cheapest) → try inserting at every position in the tech's current job sequence → for each candidate position, compute arrival time (prev job end + travel), clamp start to `max(arrival, window_start)`, reject if `start + duration > window_end` or `start + duration > shift_end` or the insertion pushes any *already-placed* later job outside its own window. Return the first position that works with the least added travel; if none work, return the most informative reason encountered (prefer WINDOW_UNREACHABLE / BUMPS_LATER_JOB over a generic failure).
- Write `feasibility.test.ts` against 2–3 real cases from the file before moving on — this function is load-bearing for requirements 2, 3, and 4 alike.

### Phase 3 — Auto-assignment (`assign.ts`)
- Objective (stated goal): **maximize number of jobs assigned**, travel time as tie-breaker.
- Algorithm: sort jobs by window tightness (`window_end - window_start` ascending, i.e. earliest-deadline-first), then for each job try `canInsert` against every technician with the matching skill, pick the technician/position with the lowest added travel minutes among feasible options; if none feasible, push to `unassigned` with the *first concrete blocking reason* found (e.g. "no technician with skill X is free in this window" vs "technician exists but travel makes it unreachable" — these are different reasons, keep them distinct).
- Output: `Plan = { routes: Record<techId, TimelineEntry[]>, unassigned: {jobId, reason, detail}[] }`.
- **Done when:** running `buildPlan` on a loaded case assigns most jobs and produces a non-empty, reasoned unassigned list on at least a few of the 25 cases (some cases are likely tighter than others — don't force 100%).

### Phase 4 — Timeline UI
- `TechnicianTimeline.tsx`: one row per technician, horizontal time axis from shift_start to shift_end. Render: job blocks (id, area, skill, window), travel gap blocks between jobs (labelled with minutes), and idle time (uncommitted gap after all travel/jobs are placed).
- `UnassignedList.tsx`: job id, required skill/area/window, and the reason code in plain language (e.g. "No plumbing technician has a free slot in Mirpur between 09:00–11:00 without missing the window").
- **Done when:** the full day plan for a selected case is visually inspectable and the unassigned list is never silently empty when jobs actually failed.

### Phase 5 — Manual override (`manualMove.ts`)
- UI: within a technician's timeline, allow reassigning a job to a different technician (dropdown per job block is simplest to ship; drag-and-drop is a nice-to-have, not required).
- On drop/selection: call `canInsert(job, targetTech, targetTech'sCurrentRoute, travelMatrix, shiftBounds)`. Show immediate pass/fail with the exact rule name if it fails (reuse the same reason codes from Phase 2 — do not invent new ones for this path).
- Wire the file's own `manual_move` field as a one-click "Run scripted move" demo button — this is literally the test case the data was built for.
- **Done when:** the scripted `manual_move` from the loaded case runs and shows a correct accept/reject with reason.

### Phase 6 — Polish
- Empty/error states (bad file, missing case fields).
- Recompute plan on case switch; clear manual-move state.

---

## 3. Bonus phases (only after 1–5 work end-to-end)

- **B1 — Emergency job mid-day:** add a form to inject a job with a "now" cursor time; re-run `buildPlan` restricted to jobs not yet started (start time > cursor) plus the new job, holding already-started/completed jobs fixed.
- **B2 — Sick technician:** remove a technician, take their not-yet-started jobs, feed them back through the same insertion loop against remaining technicians; report any that become unassigned.
- **B3 — Score & compare:** `score.ts` computes `{assignedCount, totalTravelMinutes, unassignedCount}` for the generated plan; let the user manually drag jobs into an alternate plan and show both scores side by side. This is also where a CP-SAT/OR-Tools exact solve could be swapped in later for comparison against the greedy heuristic, if desired.

---

## 4. Testing strategy
- Unit test `feasibility.ts` and `assign.ts` directly against several of the 25 bundled cases (deterministic, no UI needed) — this is the highest-value test surface since it's shared by requirements 2, 3, and 4.
- Snapshot the `manual_move` result for each case once Phase 5 lands, so future changes to `canInsert` can't silently change accept/reject outcomes.