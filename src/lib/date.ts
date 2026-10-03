export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const shiftDate = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const today = () => dateKey(new Date());
export const firstOfMonth = (s: string) => s.slice(0, 7) + "-01";
export const monthDays = (s: string) => {
  const d = parseDate(firstOfMonth(s));
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) =>
    dateKey(new Date(d.getFullYear(), d.getMonth(), i + 1, 12)),
  );
};
export const weekDays = (s: string, start: 0 | 1 = 1) => {
  const d = parseDate(s);
  const offset = (d.getDay() - start + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDate(s, i - offset));
};
export const rangeDays = (a: string, b: string) => {
  const out: string[] = [];
  for (let s = a; s <= b && out.length < 400; s = shiftDate(s, 1)) out.push(s);
  return out;
};
export const dayLabel = (s: string, options?: Intl.DateTimeFormatOptions) =>
  parseDate(s).toLocaleDateString(
    undefined,
    options ?? { weekday: "long", month: "long", day: "numeric" },
  );
export const dayOfWeek = (s: string) => parseDate(s).getDay();
export const scheduled = (
  h: {
    startDate: string;
    endDate: string;
    enabled: boolean;
    archived: boolean;
    frequency: string;
    days: number[];
  },
  date: string,
) =>
  h.enabled &&
  !h.archived &&
  date >= h.startDate &&
  (!h.endDate || date <= h.endDate) &&
  (h.frequency === "daily" ||
    (h.frequency === "weekdays" && ![0, 6].includes(dayOfWeek(date))) ||
    (h.frequency === "weekends" && [0, 6].includes(dayOfWeek(date))) ||
    (h.frequency === "custom" && h.days.includes(dayOfWeek(date))));
export const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(parseDate(s)) === s;
