import { Technician, TimelineEntry } from "./types";
import { getTravel, TravelMatrix } from "./travel";
import { shiftBoundsFor } from "./feasibility";
import { hhmmToMinutes } from "./time";

// After a route is mutated (an entry inserted or removed), every entry from
// `fromIndex` onward has a new predecessor and must have its
// arrival/start/end recomputed against the new chain.
export function recomputeRouteFrom(
  route: TimelineEntry[],
  fromIndex: number,
  tech: Technician,
  travelMatrix: TravelMatrix
): void {
  for (let i = fromIndex; i < route.length; i++) {
    const prevEnd = i === 0 ? shiftBoundsFor(tech).startMinutes : route[i - 1].end;
    const prevArea = i === 0 ? tech.home_area : route[i - 1].job.area;
    const travel = getTravel(travelMatrix, prevArea, route[i].job.area);
    const arrival = prevEnd + travel;
    const start = Math.max(arrival, hhmmToMinutes(route[i].job.window_start));
    const end = start + route[i].job.duration_minutes;
    route[i] = { ...route[i], arrival, start, end, travelFromPrev: arrival - prevEnd };
  }
}
