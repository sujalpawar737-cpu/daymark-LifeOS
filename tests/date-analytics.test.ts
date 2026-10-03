import { describe, it, expect } from "vitest";
import {
  dateKey,
  monthDays,
  shiftDate,
  weekDays,
  scheduled,
} from "../src/lib/date";
import { recordId, summary, streak } from "../src/lib/analytics";
import type { Habit, RecordEntry } from "../src/lib/types";
const habit: Habit = {
  id: "h",
  title: "Study",
  category: "Learning",
  icon: "✦",
  color: "#316e5b",
  type: "binary",
  target: 1,
  unit: "",
  frequency: "daily",
  days: [0, 1, 2, 3, 4, 5, 6],
  startDate: "2024-02-28",
  endDate: "",
  time: "",
  notes: "",
  enabled: true,
  archived: false,
  order: 1,
  createdAt: "",
};
const rec = (d: string, status: RecordEntry["status"]): RecordEntry => ({
  id: recordId("h", d),
  habitId: "h",
  date: d,
  status,
  value: status === "completed" ? 1 : 0,
  updatedAt: "",
});
describe("calendar dates", () => {
  it("handles leap day and year rollover", () => {
    expect(monthDays("2024-02-10")).toHaveLength(29);
    expect(monthDays("2025-02-10")).toHaveLength(28);
    expect(shiftDate("2024-12-31", 1)).toBe("2025-01-01");
    expect(dateKey(new Date(2024, 1, 29, 12))).toBe("2024-02-29");
  });
  it("uses a Monday week across months", () =>
    expect(weekDays("2024-03-01")).toEqual([
      "2024-02-26",
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
      "2024-03-02",
      "2024-03-03",
    ]));
  it("respects start/end and custom days", () => {
    expect(
      scheduled({ ...habit, frequency: "custom", days: [1] }, "2024-03-04"),
    ).toBe(true);
    expect(
      scheduled({ ...habit, frequency: "custom", days: [1] }, "2024-03-05"),
    ).toBe(false);
    expect(scheduled({ ...habit, endDate: "2024-03-01" }, "2024-03-02")).toBe(
      false,
    );
  });
});
describe("analytics", () => {
  it("excludes skips and N/A from denominator", () => {
    const r = [
      rec("2024-02-28", "completed"),
      rec("2024-02-29", "skipped"),
      rec("2024-03-01", "missed"),
      rec("2024-03-02", "na"),
    ];
    expect(
      summary([habit], r, [
        "2024-02-28",
        "2024-02-29",
        "2024-03-01",
        "2024-03-02",
      ]).rate,
    ).toBe(50);
  });
  it("keeps a streak through an intentional skip", () =>
    expect(
      streak(
        habit,
        [
          rec("2024-02-28", "completed"),
          rec("2024-02-29", "skipped"),
          rec("2024-03-01", "completed"),
        ],
        "2024-03-01",
      ).current,
    ).toBe(2));
  it("keeps recorded history when a habit is archived", () =>
    expect(
      summary(
        [{ ...habit, archived: true }],
        [rec("2024-02-28", "completed")],
        ["2024-02-28"],
      ).rate,
    ).toBe(100));
  it("does not count a future day as missed", () =>
    expect(summary([habit], [], ["2999-01-01"]).eligible).toBe(0));
});
