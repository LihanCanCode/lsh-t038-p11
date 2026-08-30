# Route and Shift Assignment Optimiser

Solution for **LofiStack Hackathon 2026 — P11**

## Project information

- **Team:** `Mrittu_Machines`
- **Team ID:** `LSH26-T038`
- **Problem:** `P11 — Route and Shift Assignment Optimiser`
- **Live application:** Not deployed yet — deployment planned before submission.
- **Demo video:** Not provided.

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

An in-browser technician dispatch planner: upload a route/shift dataset (technicians, jobs, travel-time matrix — 25 independent cases in the published fixture), pick a case, and the app auto-assigns jobs to technicians with a greedy earliest-deadline-first algorithm that respects skills, time windows, shifts, and travel time. Dispatchers can then reassign jobs by hand (click or drag-and-drop, both validated against the same feasibility rules), inject a mid-day emergency job, mark a technician sick, and compare their manual plan against the algorithm's baseline — all client-side, no backend.

## Requirements

| Requirement                                       | Status   | Where to verify                                                                                                                                         |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — Ingest & case selection                       | Complete | `app/page.tsx` (upload dropzone, zod-validated parsing in `lib/engine/types.ts` and `lib/engine/validate.ts`), `components/CaseSelector.tsx`            |
| R2 — Auto-assignment                                | Complete | `lib/engine/assign.ts` (`buildPlan` / `runInsertionPass`); verified in `lib/engine/__tests__/assign.test.ts` against all 25 bundled cases                |
| R3 — Timeline UI                                    | Complete | `app/planner/page.tsx`, `components/TechnicianTimeline.tsx`, `components/TimelineRuler.tsx`, `components/UnassignedList.tsx`                            |
| R4 — Manual override & validity check                | Complete | `lib/engine/manualMove.ts` (`applyManualMove`), `components/ManualMoveControl.tsx` (chip preview, scripted-move button, drag-and-drop)                  |

## How to test the application

1. Open the application (locally at `http://localhost:3000` until deployed — see [Run locally](#run-locally)).
2. On the home page, drag in `public/data/P11_route_shift_public.json` (or click to browse to it) and pick any case from the dropdown that appears.
3. Click **View plan** to open the planner. The technician timelines and unassigned-jobs list are generated immediately.
4. Try reassigning a job: click a job block (or an unassigned job) then pick a technician chip in the sidebar's **Reassign** tab, or just drag the job block onto another technician's row.
5. Try the **Emergency** and **Sick** tabs in the sidebar to inject a mid-day job or remove a technician and watch the plan re-optimize around whatever hasn't started yet.
6. Open **Score & compare** (below the sidebar) to build an alternate plan by hand and see it scored against the algorithm's baseline.

### Test or sample data

The published fixture (`public/data/P11_route_shift_public.json`, 25 independent cases) is bundled in the repository — there is no separate download step. To reset the application: refresh the page (all state is in-memory only; nothing is persisted to a backend or `localStorage`) and re-upload the same file. Switching cases from the dropdown regenerates a fresh auto-assigned plan for that case, discarding any manual moves, injected emergency jobs, or sick-technician changes made during the session.

## Run locally

### Requirements

- Node.js `>=20.9.0`
- No database
- No environment variables required (no `.env` file — the app has no backend and no API keys)

### Setup

```bash
git clone https://github.com/LihanCanCode/lsh-t038-p11
cd lsh-t038-p11
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Problem-solving approach

- **Understanding the problem:** the dataset is 25 independent single-day scheduling cases (technicians with skills/shifts/home area, jobs with skill/area/duration/time-window, and an authoritative travel-time matrix). The job was to maximize jobs assigned while respecting skills, time windows, shifts and travel time, then let a dispatcher override the result and validate ad-hoc moves.
- **Chosen solution:** a single feasibility primitive, `canInsert`, decides whether a job can go at a given position in a technician's route (skill match → arrival/window/shift check → a cascade check that never bumps an already-placed job out of its own window). A greedy earliest-deadline-first loop (`runInsertionPass`) reuses `canInsert` to build the initial plan, and the exact same primitive backs manual-move validation, mid-day emergency-job insertion, and sick-technician reassignment — one small, fully-tested function underpins every feature instead of a bespoke solver per feature.
- **Most important decision:** giving `canInsert` an optional `minInsertIndex` floor (default `0`, fully backward-compatible) so already-started work can never be disturbed by a later re-plan. This was driven by a real bug caught while writing tests: without the floor, re-inserting a job could tie on added-travel with inserting *before* an already-started job and win by first-found.
- **How it was tested:** a 161-test Vitest suite, including invariant checks run against all 25 real bundled cases (not just synthetic fixtures) — e.g. every job accounted for exactly once, locked/already-started entries always byte-identical after a re-plan, and a snapshot of the scripted `manual_move` outcome for every case. Plus `tsc --noEmit`, `eslint` with zero warnings, and manual exercising of the running app in-browser.

## Technology used

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** None — fully client-side; the dataset and generated plan live in memory for the session (Zustand store)
- **Database:** None
- **Deployment:** Not yet deployed (planned before submission)
- **Other material tools:** Zod (schema + cross-reference validation of the uploaded dataset), Vitest (unit/integration tests)

See [`LICENSES.md`](LICENSES.md) for third-party materials.

## Team contributions

| Registered member       | GitHub username   | Major contribution                                                                                                                                                                    | Evidence                                                                 |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Abrar Mahmud Hasan        | `alchemistReturns` | Full implementation: scheduling engine (feasibility checking, greedy assignment, manual-move validation, mid-day re-planning, sick-technician re-planning, scoring), the Next.js UI, and all bonus features | `lib/engine/`, `app/`, `components/`                                     |
| Tahsan Ferdous Lihan      | `LihanCanCode`      | QA and edge-case testing: found that a job or technician referencing an area missing from `areas[]` or `travel_minutes` was never validated at upload and would crash the planner mid-session | `lib/engine/validate.ts`, `lib/engine/__tests__/validate.test.ts`, `components/UploadDropzone.tsx` |

Commit count alone does not represent contribution.

## AI usage

- **Claude Code (Anthropic, Claude Sonnet 5)** — pair-programmed the entire implementation: scheduling engine, Next.js UI, all bonus features, and the repository records (`LICENSES.md`, `evaluation-manifest.json`, this README). Verified via a 161-test Vitest suite (including invariant checks against all 25 real bundled cases), `tsc --noEmit` type-checking, `eslint` with zero warnings/errors, manual review of every diff before acceptance, and manual exercising of the running app in-browser.

## Major design decisions

- **Framework-agnostic engine:** `lib/engine/` has zero React imports, so the scheduling logic is unit-tested directly against the bundled dataset, independent of the UI.
- **Shared insertion primitive with a lockable floor:** `canInsert`'s optional `minInsertIndex` (default `0`, backward-compatible) keeps already-started work untouched during mid-day re-planning or sick-technician reassignment, without duplicating logic per feature.
- **One insertion pass, three callers:** `runInsertionPass` was extracted out of `buildPlan` so the initial auto-assignment, emergency re-plan, and sick-technician re-plan all use identical greedy insertion semantics.
- **Client-only architecture:** dataset and plan live entirely in memory (Zustand), no backend — case sizes are small and judges need a simple, reproducible reset (refresh + re-upload).
- **Two equivalent reassignment inputs:** click-to-pick technician chips (with a live accept/reject preview) and native HTML5 drag-and-drop both call the same `applyManualMove` validation — one source of truth for what a valid move is.

## Known limitations

- Emergency-job injections and sick-technician markings are session-only state, not persisted; refreshing the page resets to the auto-generated baseline (by design, for reproducibility).
- Drag-and-drop and the overall layout are desktop-only; not optimized for touch devices or narrow viewports.
- The assignment algorithm is a greedy heuristic, not an exact solver — total travel is a tie-breaker, not a jointly optimized objective. The Score & Compare panel has a swap-in point for a future CP-SAT/OR-Tools exact solve, but that solve itself was not implemented.

## Repository records

- [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
- [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
- [`LICENSES.md`](LICENSES.md) — frameworks, libraries, templates and assets
