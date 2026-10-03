export type Status = "completed" | "missed" | "skipped" | "na" | "pending";
export type Frequency = "daily" | "weekdays" | "weekends" | "custom";
export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  color: string;
  type: "binary" | "count" | "duration" | "numeric";
  target: number;
  unit: string;
  frequency: Frequency;
  days: number[];
  startDate: string;
  endDate: string;
  time: string;
  notes: string;
  enabled: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
}
export interface RecordEntry {
  id: string;
  habitId: string;
  date: string;
  status: Status;
  value: number;
  updatedAt: string;
}
export interface Task {
  id: string;
  title: string;
  date: string;
  time: string;
  minutes: number;
  priority: "low" | "normal" | "high";
  notes: string;
  done: boolean;
  createdAt: string;
}
export interface Goal {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  milestone: string;
  relatedHabitId: string;
  status: "active" | "paused" | "completed";
  createdAt: string;
}
export interface Meal {
  id: string;
  day: number;
  category: string;
  time: string;
  title: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
  order: number;
}
export interface Workout {
  id: string;
  day: number;
  title: string;
  muscle: string;
  exercises: string;
  duration: number;
  notes: string;
  restDay: boolean;
  order: number;
}
export interface PlanRecord {
  id: string;
  kind: "meal" | "workout";
  planId: string;
  date: string;
  status: Status;
}
export interface Review {
  id: string;
  date: string;
  mood: number;
  energy: number;
  sleep: number;
  notes: string;
  wins: string;
}
export interface Profile {
  displayName: string;
  theme: "light" | "dark" | "system";
  weekStart: 0 | 1;
  timeFormat: "12" | "24";
  dailyReminder: string;
  createdAt: string;
}
export type CollectionName =
  | "habits"
  | "records"
  | "tasks"
  | "goals"
  | "meals"
  | "workouts"
  | "planRecords"
  | "reviews";
export interface DataState {
  habits: Habit[];
  records: RecordEntry[];
  tasks: Task[];
  goals: Goal[];
  meals: Meal[];
  workouts: Workout[];
  planRecords: PlanRecord[];
  reviews: Review[];
}
export const emptyData: DataState = {
  habits: [],
  records: [],
  tasks: [],
  goals: [],
  meals: [],
  workouts: [],
  planRecords: [],
  reviews: [],
};
