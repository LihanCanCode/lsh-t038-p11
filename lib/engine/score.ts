import { Plan } from "./types";

export type PlanScore = {
  assignedCount: number;
  totalTravelMinutes: number;
  unassignedCount: number;
};

export function scorePlan(plan: Plan): PlanScore {
  const routes = Object.values(plan.routes);
  return {
    assignedCount: routes.reduce((sum, route) => sum + route.length, 0),
    totalTravelMinutes: routes.flat().reduce((sum, entry) => sum + entry.travelFromPrev, 0),
    unassignedCount: plan.unassigned.length,
  };
}
