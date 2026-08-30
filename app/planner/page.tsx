"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSelectedCase } from "@/lib/store/useDatasetStore";
import { buildPlan } from "@/lib/engine/assign";
import { applyManualMove } from "@/lib/engine/manualMove";
import { injectEmergencyJob } from "@/lib/engine/emergency";
import { removeSickTechnician } from "@/lib/engine/sickTechnician";
import { Case, Job, Plan } from "@/lib/engine/types";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/engine/time";
import CaseSelector from "@/components/CaseSelector";
import TechnicianTimeline from "@/components/TechnicianTimeline";
import TimelineRuler from "@/components/TimelineRuler";
import UnassignedList from "@/components/UnassignedList";
import SkillLegend from "@/components/SkillLegend";
import StatCard from "@/components/StatCard";
import ManualMoveControl, { MoveOutcome, MovePreview } from "@/components/ManualMoveControl";
import EmergencyJobForm, { EmergencyJobInput } from "@/components/EmergencyJobForm";
import SickTechnicianForm from "@/components/SickTechnicianForm";

export default function PlannerPage() {
  const kase = useSelectedCase();
  const [planCaseId, setPlanCaseId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [extraJobs, setExtraJobs] = useState<Job[]>([]);
  const [emergencyCounter, setEmergencyCounter] = useState(1);
  const [cursorMinutes, setCursorMinutes] = useState<number | null>(null);
  const [sickTechnicianIds, setSickTechnicianIds] = useState<Set<string>>(new Set());

  // Rebuild the plan whenever the selected case changes. Done during render
  // (not an effect) so the freshly-built plan is used for this render.
  // buildPlan can throw on malformed engine input (e.g. an area reference
  // getTravel can't resolve) — caught here so a bad case can never take down
  // the whole page with an uncaught exception.
  if ((kase?.case_id ?? null) !== planCaseId) {
    setPlanCaseId(kase?.case_id ?? null);
    setSelectedJobId(null);
    setExtraJobs([]);
    setEmergencyCounter(1);
    setCursorMinutes(null);
    setSickTechnicianIds(new Set());
    if (!kase) {
      setPlan(null);
      setPlanError(null);
    } else {
      try {
        setPlan(buildPlan(kase));
        setPlanError(null);
      } catch (e) {
        setPlan(null);
        setPlanError(e instanceof Error ? e.message : "Unknown error building this plan.");
      }
    }
  }

  // Jobs injected mid-day (bonus B1) aren't in the uploaded case, but every
  // engine call needs to be able to look them up by id — so downstream code
  // uses this merged view instead of the raw case.
  const effectiveCase: Case | null = useMemo(() => {
    if (!kase) return null;
    if (extraJobs.length === 0) return kase;
    return { ...kase, jobs: [...kase.jobs, ...extraJobs] };
  }, [kase, extraJobs]);

  const jobsById = useMemo(
    () => new Map((effectiveCase?.jobs ?? []).map((job) => [job.id, job])),
    [effectiveCase]
  );

  const stats = useMemo(() => {
    if (!kase || !plan) return null;
    const assigned = Object.values(plan.routes).reduce((sum, r) => sum + r.length, 0);
    const totalTravel = Object.values(plan.routes)
      .flat()
      .reduce((sum, entry) => sum + entry.travelFromPrev, 0);
    return { assigned, unassigned: plan.unassigned.length, totalTravel };
  }, [kase, plan]);

  const skills = useMemo(
    () => Array.from(new Set((effectiveCase?.jobs ?? []).map((job) => job.skill))).sort(),
    [effectiveCase]
  );

  const globalRange = useMemo(() => {
    const technicians = kase?.technicians ?? [];
    if (technicians.length === 0) return { start: 0, end: 24 * 60 };
    return {
      start: Math.min(...technicians.map((t) => hhmmToMinutes(t.shift_start))),
      end: Math.max(...technicians.map((t) => hhmmToMinutes(t.shift_end))),
    };
  }, [kase]);

  const currentTechIdOf = (jobId: string): string | null => {
    if (!plan) return null;
    for (const [techId, route] of Object.entries(plan.routes)) {
      if (route.some((e) => e.job.id === jobId)) return techId;
    }
    return null;
  };

  function handleMove(jobId: string, toTechId: string): MoveOutcome {
    if (!plan || !effectiveCase) return { ok: false, error: "No plan loaded." };
    try {
      const result = applyManualMove(plan, jobId, toTechId, effectiveCase);
      if (result.ok) {
        setPlan(result.newPlan);
        return { ok: true };
      }
      return { ok: false, reason: result.reason };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  function previewMove(jobId: string, toTechId: string): MovePreview {
    if (!plan || !effectiveCase) return { ok: false, reason: "OUTSIDE_SHIFT" };
    try {
      const result = applyManualMove(plan, jobId, toTechId, effectiveCase);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    } catch {
      return { ok: false, reason: "OUTSIDE_SHIFT" };
    }
  }

  function handleInjectEmergency(input: EmergencyJobInput): { ok: boolean; message: string } {
    if (!plan || !effectiveCase) return { ok: false, message: "No plan loaded." };
    if (hhmmToMinutes(input.window_start) >= hhmmToMinutes(input.window_end)) {
      return { ok: false, message: "Window start must be before window end." };
    }

    const id = `EMG-${emergencyCounter}`;
    const newJob: Job = {
      id,
      area: input.area,
      skill: input.skill,
      duration_minutes: input.duration_minutes,
      window_start: input.window_start,
      window_end: input.window_end,
    };

    try {
      const cursor = hhmmToMinutes(input.cursor);
      const result = injectEmergencyJob(plan, cursor, newJob, effectiveCase);
      const placed = Object.values(result.routes)
        .flat()
        .some((entry) => entry.job.id === id);

      setPlan(result);
      setExtraJobs((prev) => [...prev, newJob]);
      setEmergencyCounter((n) => n + 1);
      setCursorMinutes(cursor);
      setSelectedJobId(id);

      return {
        ok: placed,
        message: placed
          ? `${id} injected at ${input.cursor} and scheduled. Jobs starting after ${input.cursor} were re-optimized; anything already underway was left alone.`
          : `${id} injected, but no technician could take it — see Unassigned jobs below.`,
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Unknown error." };
    }
  }

  function handleMarkSick(techId: string, cursorHHMM: string): { ok: boolean; message: string } {
    if (!plan || !effectiveCase) return { ok: false, message: "No plan loaded." };

    try {
      const cursor = hhmmToMinutes(cursorHHMM);
      const result = removeSickTechnician(plan, techId, cursor, effectiveCase);
      setPlan(result);
      setSickTechnicianIds((prev) => new Set(prev).add(techId));
      setCursorMinutes(cursor);

      const stillUnassigned = result.unassigned.length;
      return {
        ok: true,
        message:
          `${techId} marked sick as of ${cursorHHMM}. Work already done stays theirs; anything not yet ` +
          `started was reassigned where possible` +
          (stillUnassigned > 0 ? ` (${stillUnassigned} job(s) now unassigned).` : "."),
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Unknown error." };
    }
  }

  const availableTechnicians = kase ? kase.technicians.filter((t) => !sickTechnicianIds.has(t.id)) : [];

  if (planError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="max-w-md text-sm text-rose-600">Couldn&apos;t build a plan for this case: {planError}</p>
        <Link href="/" className="text-sm font-medium text-violet-600 underline-offset-4 hover:underline">
          Go pick a different case
        </Link>
      </div>
    );
  }

  if (!kase || !plan || !stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-stone-500">No case loaded yet.</p>
        <Link href="/" className="text-sm font-medium text-violet-600 underline-offset-4 hover:underline">
          Go upload a dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-4xl flex-col gap-6 py-10 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
              <Link href="/" className="hover:text-violet-600">
                Dispatch Planner
              </Link>
              <span>/</span>
              <span className="font-mono tabular-nums">{kase.today}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{kase.case_id}</h1>
          </div>
          <CaseSelector />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Technicians" value={kase.technicians.length} />
          <StatCard
            label="Assigned"
            value={`${stats.assigned}/${effectiveCase?.jobs.length ?? kase.jobs.length}`}
            accent="positive"
          />
          <StatCard
            label="Unassigned"
            value={stats.unassigned}
            accent={stats.unassigned > 0 ? "negative" : "default"}
          />
          <StatCard label="Total travel" value={`${stats.totalTravel}m`} />
        </dl>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Technician timelines
            </h2>
            <SkillLegend skills={skills} />
          </div>
          <div className="px-2">
            <TimelineRuler startMinutes={globalRange.start} endMinutes={globalRange.end} />
          </div>
          <div className="relative flex flex-col divide-y divide-stone-100">
            {kase.technicians.map((tech) => (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={plan.routes[tech.id] ?? []}
                globalStart={globalRange.start}
                globalEnd={globalRange.end}
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
                isSick={sickTechnicianIds.has(tech.id)}
              />
            ))}
            {cursorMinutes !== null && cursorMinutes >= globalRange.start && cursorMinutes <= globalRange.end && (
              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-px bg-violet-500"
                style={{
                  left: `calc(8px + (100% - 16px) * ${
                    (cursorMinutes - globalRange.start) / Math.max(globalRange.end - globalRange.start, 1)
                  })`,
                }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  now · {minutesToHhmm(cursorMinutes)}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Emergency job (mid-day)
          </h2>
          <EmergencyJobForm
            key={kase.case_id}
            areas={kase.areas}
            defaultCursor={minutesToHhmm(
              globalRange.start + Math.round((globalRange.end - globalRange.start) / 2 / 5) * 5
            )}
            onSubmit={handleInjectEmergency}
          />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Sick technician (mid-day)
          </h2>
          <SickTechnicianForm
            key={kase.case_id + sickTechnicianIds.size}
            technicians={availableTechnicians}
            defaultCursor={minutesToHhmm(
              globalRange.start + Math.round((globalRange.end - globalRange.start) / 2 / 5) * 5
            )}
            onSubmit={handleMarkSick}
          />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Reassign a job
          </h2>
          <ManualMoveControl
            job={selectedJobId ? jobsById.get(selectedJobId) ?? null : null}
            currentTechId={selectedJobId ? currentTechIdOf(selectedJobId) : null}
            technicians={availableTechnicians}
            manualMove={kase.manual_move}
            onMove={handleMove}
            previewMove={previewMove}
          />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Unassigned jobs ({plan.unassigned.length})
          </h2>
          <UnassignedList unassigned={plan.unassigned} jobsById={jobsById} onSelectJob={setSelectedJobId} />
        </section>
      </main>
    </div>
  );
}
