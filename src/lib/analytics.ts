import { scheduled, shiftDate, today } from "./date";
import type { Habit, RecordEntry, Status } from "./types";
export const lookup = (records: RecordEntry[]) =>
  new Map(records.map((r) => [r.id, r]));
export const recordId = (habitId: string, date: string) => `${habitId}_${date}`;
export function summary(
  habits: Habit[],
  records: RecordEntry[],
  dates: string[],
) {
  const map = lookup(records);
  let completed = 0,
    missed = 0,
    skipped = 0,
    pending = 0;
  for (const date of dates)
    for (const h of habits)
      if (
        (scheduled(h, date) || map.has(recordId(h.id, date))) &&
        date <= today()
      ) {
        const state = map.get(recordId(h.id, date))?.status ?? "pending";
        if (state === "completed") completed++;
        else if (state === "missed") missed++;
        else if (state === "skipped") skipped++;
        else if (state === "pending") pending++;
      }
  const eligible = completed + missed + pending;
  return {
    completed,
    missed,
    skipped,
    pending,
    eligible,
    rate: eligible ? Math.round((completed / eligible) * 100) : 0,
  };
}
export function streak(h: Habit, records: RecordEntry[], until = today()) {
  const map = lookup(records);
  let current = 0,
    longest = 0,
    run = 0,
    unbroken = true;
  for (
    let date = until, i = 0;
    i < 3660 && date >= h.startDate;
    i++, date = shiftDate(date, -1)
  ) {
    if (!scheduled(h, date) && !map.has(recordId(h.id, date))) continue;
    const state: Status = map.get(recordId(h.id, date))?.status ?? "pending";
    if (state === "skipped" || state === "na") continue;
    if (state === "completed") {
      run++;
      if (unbroken) current++;
      longest = Math.max(longest, run);
    } else {
      if (!(date === until && state === "pending")) unbroken = false;
      run = 0;
    }
  }
  return { current, longest };
}
export const habitRate = (h: Habit, records: RecordEntry[], dates: string[]) =>
  summary([h], records, dates).rate;
