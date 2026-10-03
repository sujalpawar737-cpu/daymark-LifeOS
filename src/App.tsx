import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  deleteUser,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from "firebase/auth";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import Modal from "./components/Modal";
import { auth, configured } from "./lib/firebase";
import {
  save,
  remove,
  watchData,
  watchProfile,
  saveProfile,
  exportAll,
  eraseData,
  importData,
} from "./lib/store";
import {
  dateKey,
  dayLabel,
  dayOfWeek,
  firstOfMonth,
  monthDays,
  parseDate,
  rangeDays,
  shiftDate,
  today,
  weekDays,
  scheduled,
  validDate,
} from "./lib/date";
import { summary, streak, habitRate, recordId, lookup } from "./lib/analytics";
import {
  emptyData,
  type CollectionName,
  type DataState,
  type Habit,
  type Task,
  type Goal,
  type Meal,
  type Workout,
  type Profile,
  type Status,
  type Review,
  type PlanRecord,
} from "./lib/types";

type Page =
  | "Today"
  | "Tracker"
  | "Planner"
  | "Meals"
  | "Training"
  | "Insights"
  | "Settings";
type Entity = "habit" | "task" | "goal" | "meal" | "workout";
const nav: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Today", icon: LayoutDashboard },
  { name: "Tracker", icon: CalendarDays },
  { name: "Planner", icon: Activity },
  { name: "Meals", icon: Utensils },
  { name: "Training", icon: Dumbbell },
  { name: "Insights", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const colors = [
  "#316e5b",
  "#de8b64",
  "#6e78a9",
  "#af8240",
  "#8a6894",
  "#527e95",
];
const iconOptions = ["✦", "◉", "☀", "✎", "♡", "⚡", "◆", "✿", "◷", "♫"];
const defaultProfile = (): Profile => ({
  displayName: "",
  theme: "system",
  weekStart: 1,
  timeFormat: "12",
  dailyReminder: "",
  createdAt: new Date().toISOString(),
});
const uid = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();
const newHabit = (): Habit => ({
  id: uid(),
  title: "",
  category: "Personal",
  icon: "✦",
  color: colors[0],
  type: "binary",
  target: 1,
  unit: "",
  frequency: "daily",
  days: [1, 2, 3, 4, 5, 6, 0],
  startDate: today(),
  endDate: "",
  time: "",
  notes: "",
  enabled: true,
  archived: false,
  order: Date.now(),
  createdAt: stamp(),
});
const newTask = (date: string): Task => ({
  id: uid(),
  title: "",
  date,
  time: "",
  minutes: 0,
  priority: "normal",
  notes: "",
  done: false,
  createdAt: stamp(),
});
const newGoal = (): Goal => ({
  id: uid(),
  title: "",
  description: "",
  target: 1,
  current: 0,
  unit: "",
  deadline: "",
  milestone: "",
  relatedHabitId: "",
  status: "active",
  createdAt: stamp(),
});
const newMeal = (day: number): Meal => ({
  id: uid(),
  day,
  category: "Breakfast",
  time: "",
  title: "",
  quantity: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  notes: "",
  order: Date.now(),
});
const newWorkout = (day: number): Workout => ({
  id: uid(),
  day,
  title: "",
  muscle: "",
  exercises: "",
  duration: 0,
  notes: "",
  restDay: false,
  order: Date.now(),
});
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-glyph">✳</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function StatusButtons({
  status,
  onSet,
  compact = false,
}: {
  status: Status;
  onSet: (s: Status) => void;
  compact?: boolean;
}) {
  return (
    <div className={"status-actions " + (compact ? "compact" : "")}>
      <button
        title="Completed"
        aria-label="Mark completed"
        className={
          "status-button complete " + (status === "completed" ? "selected" : "")
        }
        onClick={() => onSet(status === "completed" ? "pending" : "completed")}
      >
        <Check size={16} />
      </button>
      <button
        title="Not completed"
        aria-label="Mark not completed"
        className={
          "status-button miss " + (status === "missed" ? "selected" : "")
        }
        onClick={() => onSet(status === "missed" ? "pending" : "missed")}
      >
        <X size={16} />
      </button>
      <select
        aria-label="Other status"
        value={
          status === "completed" || status === "missed" ? "pending" : status
        }
        onChange={(e) => onSet(e.target.value as Status)}
      >
        <option value="pending">···</option>
        <option value="skipped">Skip</option>
        <option value="na">N/A</option>
      </select>
    </div>
  );
}
function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage("If an account exists, a reset email has been sent.");
      } else if (mode === "signup") {
        const c = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(c.user, { displayName: name.trim() });
        await saveProfile(c.user.uid, {
          ...defaultProfile(),
          displayName: name.trim(),
        });
        await sendEmailVerification(c.user);
      } else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setMessage(
        (err as Error).message
          .replace("Firebase: ", "")
          .replace(/\(auth\/[^)]+\)/g, "")
          .trim(),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-shell">
      <div className="auth-story">
        <div className="brand light">
          <span className="brand-symbol">✳</span> Daymark
        </div>
        <div>
          <span className="eyebrow pale">A CLEARER WAY THROUGH THE DAY</span>
          <h1>
            Your days,
            <br />
            <em>well lived.</em>
          </h1>
          <p>
            One calm place for habits, plans, nourishment and progress. Build a
            rhythm that feels like yours.
          </p>
        </div>
        <span className="auth-foot">Make today count. Tomorrow follows.</span>
      </div>
      <div className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">WELCOME TO DAYMARK</span>
          <h2>
            {mode === "login"
              ? "Good to see you again"
              : mode === "signup"
                ? "Start your new rhythm"
                : "Reset your password"}
          </h2>
          <p>
            {mode === "login"
              ? "Pick up right where you left off."
              : mode === "signup"
                ? "Create a private space for your plans."
                : "We’ll email you a reset link."}
          </p>
          {mode === "signup" && (
            <Field label="Your name">
              <input
                required
                maxLength={60}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== "reset" && (
            <Field label="Password">
              <input
                required
                minLength={6}
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}
          <button
            className="button primary wide"
            disabled={busy || !configured}
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset email"}
          </button>
          {!configured && (
            <p className="form-message">
              Add your Firebase values to .env.local, then restart the
              development server.
            </p>
          )}
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                <button type="button" onClick={() => setMode("reset")}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMode("login")}>
                ← Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined),
    [data, setData] = useState<DataState>(emptyData),
    [profile, setProfile] = useState<Profile | null>(null),
    [page, setPage] = useState<Page>("Today"),
    [date, setDate] = useState(today()),
    [view, setView] = useState<"day" | "week" | "month" | "custom">("week"),
    [customFrom, setCustomFrom] = useState(today()),
    [customTo, setCustomTo] = useState(today()),
    [modal, setModal] = useState<{
      entity: Entity;
      item?: Habit | Task | Goal | Meal | Workout;
    } | null>(null),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false),
    [cached, setCached] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [clock, setClock] = useState(new Date());
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    const t = setInterval(() => {
      setClock(new Date());
      if (date === today()) setDate(today());
    }, 60000);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
      clearInterval(t);
    };
  }, [date]);
  useEffect(() => {
    if (!user) {
      setData(emptyData);
      setProfile(null);
      return;
    }
    const states = new Map<
      CollectionName,
      { pending: boolean; cache: boolean }
    >();
    const unsubs = watchData(
      user.uid,
      (name, items, p, c) => {
        setData((prev) => ({ ...prev, [name]: items }));
        states.set(name, { pending: p, cache: c });
        setPending([...states.values()].some((x) => x.pending));
        setCached([...states.values()].some((x) => x.cache));
      },
      (err) => setNotice(err.message),
    );
    unsubs.push(
      watchProfile(user.uid, setProfile, (err) => setNotice(err.message)),
    );
    return () => unsubs.forEach((f) => f());
  }, [user]);
  useEffect(() => {
    const theme = profile?.theme ?? "system";
    document.documentElement.dataset.theme =
      theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
  }, [profile?.theme]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const records = useMemo(() => lookup(data.records), [data.records]);
  const habits = useMemo(
    () =>
      [...data.habits]
        .filter((h) => !h.archived && h.enabled)
        .sort((a, b) => a.order - b.order),
    [data.habits],
  );
  const due = habits.filter((h) => scheduled(h, date));
  const tasks = data.tasks
    .filter((t) => t.date === date)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  const daySummary = summary(habits, data.records, [date]);
  const monthDates = monthDays(date),
    weekDates = weekDays(date, profile?.weekStart ?? 1);
  const dates =
    view === "day"
      ? [date]
      : view === "week"
        ? weekDates
        : view === "month"
          ? monthDates
          : validDate(customFrom) &&
              validDate(customTo) &&
              customFrom <= customTo
            ? rangeDays(customFrom, customTo)
            : [];
  const write = async <T extends { id: string }>(
    name: CollectionName,
    item: T,
  ) => {
    if (!user) return;
    try {
      await save(user.uid, name, item);
    } catch (e) {
      setNotice(`Couldn't save: ${(e as Error).message}`);
    }
  };
  const del = async (name: CollectionName, id: string) => {
    if (
      !user ||
      !window.confirm("Delete this item? Its history may remain for export.")
    )
      return;
    try {
      await remove(user.uid, name, id);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const setStatus = (
    h: Habit,
    d: string,
    status: Status,
    value = status === "completed" ? h.target : 0,
  ) =>
    write("records", {
      id: recordId(h.id, d),
      habitId: h.id,
      date: d,
      status,
      value,
      updatedAt: stamp(),
    });
  const setPlanStatus = (
    kind: "meal" | "workout",
    id: string,
    d: string,
    status: Status,
  ) =>
    write("planRecords", {
      id: `${kind}_${id}_${d}`,
      kind,
      planId: id,
      date: d,
      status,
    } as PlanRecord);
  const getPlanStatus = (kind: "meal" | "workout", id: string, d: string) =>
    data.planRecords.find((r) => r.id === `${kind}_${id}_${d}`)?.status ??
    "pending";
  const moveHabit = async (h: Habit, delta: number) => {
    const ordered = [...data.habits].sort((a, b) => a.order - b.order),
      i = ordered.findIndex((x) => x.id === h.id),
      other = ordered[i + delta];
    if (!other) return;
    void write("habits", { ...h, order: other.order });
    void write("habits", { ...other, order: h.order });
  };
  const changeDate = (direction: number) => {
    if (view === "month") {
      const d = parseDate(date);
      d.setMonth(d.getMonth() + direction, 1);
      setDate(dateKey(d));
    } else setDate(shiftDate(date, direction * (view === "week" ? 7 : 1)));
  };
  const toast = (s: string) => setNotice(s);
  const dayMeals = data.meals
    .filter((m) => m.day === dayOfWeek(date))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  const dayWorkouts = data.workouts
    .filter((w) => w.day === dayOfWeek(date))
    .sort((a, b) => a.order - b.order);
  const navTo = (p: Page) => {
    setPage(p);
    setMenuOpen(false);
  };
  if (user === undefined)
    return (
      <div className="loading">
        <span className="brand-symbol">✳</span>
        <p>Finding your rhythm…</p>
      </div>
    );
  if (!user) return <AuthScreen />;
  return (
    <div className="app">
      <aside className={"sidebar " + (menuOpen ? "open" : "")}>
        <div className="brand">
          <span className="brand-symbol">✳</span> Daymark
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navTo(name)}
              className={"nav-item " + (page === name ? "active" : "")}
            >
              <Icon size={19} strokeWidth={1.8} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-date">
            <span>✦</span>
            <div>
              <strong>{dayLabel(today(), { weekday: "long" })}</strong>
              <small>
                {dayLabel(today(), {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </small>
            </div>
          </div>
          <div className="user-row">
            <div className="avatar">
              {(profile?.displayName ||
                user.displayName ||
                user.email ||
                "D")[0].toUpperCase()}
            </div>
            <div>
              <strong>
                {profile?.displayName || user.displayName || "Your space"}
              </strong>
              <small>{user.email}</small>
            </div>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            WORKSPACE <span>/</span> <strong>{page.toUpperCase()}</strong>
          </div>
          <div className="top-actions">
            <span
              className={"sync " + (!online ? "offline" : "")}
              title={
                pending
                  ? "Changes are syncing"
                  : cached
                    ? "Showing cached data"
                    : "Connected"
              }
            >
              <i />
              {!online
                ? "Offline"
                : pending
                  ? "Syncing"
                  : cached
                    ? "Cached"
                    : "Synced"}
            </span>
            <span className="top-date">
              {clock.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12: profile?.timeFormat !== "24",
              })}
            </span>
            <button
              className="avatar small"
              onClick={() => navTo("Settings")}
              aria-label="Settings"
            >
              {(profile?.displayName || user.email || "D")[0].toUpperCase()}
            </button>
          </div>
        </header>
        <div className="content">
          {page === "Today" && (
            <>
              <div className="hero">
                <div>
                  <div className="eyebrow pale">
                    {dayLabel(date, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }).toUpperCase()}
                  </div>
                  <h1>
                    {date === today() ? "Make today count." : "A day in focus."}
                  </h1>
                  <p>
                    Your habits, tasks, meals and movement in one clear view.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button cream"
                      onClick={() => setModal({ entity: "task" })}
                    >
                      <Plus size={17} /> Add a task
                    </button>
                    <button
                      className="button ghost-light"
                      onClick={() => setModal({ entity: "habit" })}
                    >
                      New habit <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="hero-progress">
                  <div
                    className="ring"
                    style={
                      {
                        "--progress": `${daySummary.rate}%`,
                      } as React.CSSProperties
                    }
                  >
                    <div>
                      <strong>{daySummary.rate}%</strong>
                      <span>complete</span>
                    </div>
                  </div>
                  <small>
                    {daySummary.completed} of {daySummary.eligible} habits
                  </small>
                </div>
                <div className="hero-art">✳</div>
              </div>
              <div className="date-toolbar">
                <div className="date-title">
                  <button
                    className="icon-button"
                    onClick={() => setDate(shiftDate(date, -1))}
                    aria-label="Previous day"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2>
                    {date === today()
                      ? "Today"
                      : dayLabel(date, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                  </h2>
                  <button
                    className="icon-button"
                    onClick={() => setDate(shiftDate(date, 1))}
                    aria-label="Next day"
                  >
                    <ArrowRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDate(today())}
                  >
                    Today
                  </button>
                </div>
                <input
                  aria-label="Choose date"
                  type="date"
                  value={date}
                  onChange={(e) =>
                    validDate(e.target.value) && setDate(e.target.value)
                  }
                />
              </div>
              <div className="dashboard-grid">
                <section className="card habits-card">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">YOUR DAILY RHYTHM</span>
                      <h2>
                        Habits{" "}
                        <span className="muted-count">
                          {daySummary.completed}/{daySummary.eligible}
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navTo("Tracker")}
                    >
                      View tracker <ArrowRight size={15} />
                    </button>
                  </div>
                  {due.length ? (
                    due.map((h) => (
                      <div className="habit-line" key={h.id}>
                        <div className="habit-identity">
                          <span
                            className="habit-icon"
                            style={{
                              background: h.color + "22",
                              color: h.color,
                            }}
                          >
                            {h.icon}
                          </span>
                          <div>
                            <strong>{h.title}</strong>
                            <small>
                              {h.category}
                              {h.time ? " · " + h.time : ""}
                            </small>
                          </div>
                        </div>
                        {h.type !== "binary" && (
                          <button
                            className="subtle"
                            title="Record a value"
                            onClick={() => {
                              const raw = prompt(
                                `Enter ${h.unit || "value"} (target ${h.target})`,
                                String(
                                  records.get(recordId(h.id, date))?.value ?? 0,
                                ),
                              );
                              if (raw === null) return;
                              const n = Number(raw);
                              if (!Number.isFinite(n) || n < 0 || n > 1000000) {
                                toast("Enter a valid positive value.");
                                return;
                              }
                              setStatus(
                                h,
                                date,
                                n >= h.target ? "completed" : "pending",
                                n,
                              );
                            }}
                          >
                            {records.get(recordId(h.id, date))?.value ?? 0}/
                            {h.target}
                          </button>
                        )}
                        <StatusButtons
                          status={
                            records.get(recordId(h.id, date))?.status ??
                            "pending"
                          }
                          onSet={(s) => setStatus(h, date, s)}
                        />
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="Begin with one habit"
                      body="Add a small action you want to repeat. Your day starts here."
                      action={
                        <button
                          className="button primary"
                          onClick={() => setModal({ entity: "habit" })}
                        >
                          <Plus size={16} /> Add habit
                        </button>
                      }
                    />
                  )}
                  <button
                    className="inline-add"
                    onClick={() => setModal({ entity: "habit" })}
                  >
                    <Plus size={16} /> Add another habit
                  </button>
                </section>
                <div className="stack">
                  <section className="card">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">THE PLAN</span>
                        <h2>Today's tasks</h2>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Add task"
                        onClick={() => setModal({ entity: "task" })}
                      >
                        <Plus size={19} />
                      </button>
                    </div>
                    {tasks.length ? (
                      tasks.slice(0, 6).map((t) => (
                        <div className="task-line" key={t.id}>
                          <button
                            className={"task-check " + (t.done ? "done" : "")}
                            aria-label={
                              t.done ? "Mark task unfinished" : "Complete task"
                            }
                            onClick={() =>
                              write("tasks", { ...t, done: !t.done })
                            }
                          >
                            {t.done && <Check size={15} />}
                          </button>
                          <div className="grow">
                            <strong className={t.done ? "struck" : ""}>
                              {t.title}
                            </strong>
                            <small>
                              {t.time || "Anytime"}
                              {t.priority === "high" ? " · Priority" : ""}
                            </small>
                          </div>
                          <button
                            className="subtle"
                            onClick={() =>
                              setModal({ entity: "task", item: t })
                            }
                            aria-label={`Edit ${t.title}`}
                          >
                            Edit
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="quiet">
                        A little room to breathe. Add your first task for this
                        day.
                      </p>
                    )}
                    <button
                      className="inline-add"
                      onClick={() => navTo("Planner")}
                    >
                      Open planner <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="card daily-plan">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">TAKE CARE OF YOURSELF</span>
                        <h2>Today's plan</h2>
                      </div>
                    </div>
                    <div className="plan-summary">
                      <span className="plan-emoji">◌</span>
                      <div>
                        <strong>Meals</strong>
                        <small>
                          {dayMeals.length
                            ? dayMeals.map((m) => m.category).join(" · ")
                            : "No meals planned"}
                        </small>
                      </div>
                      <button
                        onClick={() => navTo("Meals")}
                        aria-label="Open meals"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    <div className="plan-summary">
                      <span className="plan-emoji">↗</span>
                      <div>
                        <strong>Movement</strong>
                        <small>
                          {dayWorkouts.length
                            ? dayWorkouts
                                .map((w) => (w.restDay ? "Rest day" : w.title))
                                .join(" · ")
                            : "No workout planned"}
                        </small>
                      </div>
                      <button
                        onClick={() => navTo("Training")}
                        aria-label="Open training"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                </div>
              </div>
              <div className="bottom-grid">
                <section className="card">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">KEEP GOING</span>
                      <h2>Active goals</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navTo("Planner")}
                    >
                      See all
                    </button>
                  </div>
                  {data.goals.filter((g) => g.status === "active").length ? (
                    data.goals
                      .filter((g) => g.status === "active")
                      .slice(0, 3)
                      .map((g) => (
                        <div className="goal-mini" key={g.id}>
                          <div>
                            <strong>{g.title}</strong>
                            <span>
                              {Math.min(
                                100,
                                Math.round((g.current / g.target) * 100),
                              )}
                              %
                            </span>
                          </div>
                          <div className="bar">
                            <i
                              style={{
                                width: `${Math.min(100, (g.current / g.target) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="quiet">
                      Set a goal and watch your progress grow.
                    </p>
                  )}
                </section>
                <section className="card quote-card">
                  <span className="eyebrow">A NOTE FOR TODAY</span>
                  <blockquote>
                    “Great things are done by a series of small things brought
                    together.”
                  </blockquote>
                  <span>— Vincent van Gogh</span>
                </section>
              </div>
            </>
          )}
          {page === "Tracker" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SHOW UP, ONE DAY AT A TIME</span>
                  <h1>Habit tracker</h1>
                  <p>A clear picture of the days you showed up.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setModal({ entity: "habit" })}
                >
                  <Plus size={17} /> New habit
                </button>
              </div>
              <section className="card tracker-controls">
                <div className="view-tabs">
                  {(["day", "week", "month", "custom"] as const).map((v) => (
                    <button
                      className={view === v ? "active" : ""}
                      onClick={() => setView(v)}
                      key={v}
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="date-nav">
                  <button
                    className="icon-button"
                    onClick={() => changeDate(-1)}
                    aria-label="Previous"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <strong>
                    {view === "month"
                      ? dayLabel(firstOfMonth(date), {
                          month: "long",
                          year: "numeric",
                        })
                      : view === "week"
                        ? `${dayLabel(weekDates[0], { month: "short", day: "numeric" })} – ${dayLabel(weekDates[6], { month: "short", day: "numeric", year: "numeric" })}`
                        : dayLabel(date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                  </strong>
                  <button
                    className="icon-button"
                    onClick={() => changeDate(1)}
                    aria-label="Next"
                  >
                    <ArrowRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDate(today())}
                  >
                    Today
                  </button>
                </div>
                {view === "custom" && (
                  <div className="custom-dates">
                    <input
                      type="date"
                      aria-label="Range start"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="date"
                      aria-label="Range end"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                    <small>Up to 400 days</small>
                  </div>
                )}
              </section>
              <div className="tracker-summary">
                <div>
                  <span>COMPLETED</span>
                  <strong>
                    {summary(habits, data.records, dates).completed}
                  </strong>
                </div>
                <div>
                  <span>CONSISTENCY</span>
                  <strong>{summary(habits, data.records, dates).rate}%</strong>
                </div>
                <div>
                  <span>SKIPPED</span>
                  <strong>
                    {summary(habits, data.records, dates).skipped}
                  </strong>
                </div>
                <div>
                  <span>ACTIVE HABITS</span>
                  <strong>{habits.length}</strong>
                </div>
              </div>
              <section className="card tracker-card">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">HABIT × DATE</span>
                    <h2>Your record</h2>
                  </div>
                  <div className="search-box">
                    <input
                      aria-label="Search habits"
                      placeholder="Search habits…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                      className="text-button"
                      onClick={() => setShowArchived(!showArchived)}
                    >
                      {showArchived ? "Active" : "Archived"}
                    </button>
                  </div>
                </div>
                {habits.length || showArchived ? (
                  <>
                    <div className="grid-scroll">
                      <table className="habit-grid">
                        <thead>
                          <tr>
                            <th>Habit</th>
                            {dates.map((d) => (
                              <th
                                className={d === today() ? "today-col" : ""}
                                key={d}
                              >
                                <small>
                                  {dayLabel(d, { weekday: "short" })}
                                </small>
                                <br />
                                {parseDate(d).getDate()}
                              </th>
                            ))}
                            <th>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showArchived
                            ? data.habits.filter((h) => h.archived)
                            : habits
                          )
                            .filter((h) =>
                              h.title
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                            )
                            .map((h) => (
                              <tr key={h.id}>
                                <th>
                                  <button
                                    className="habit-name"
                                    onClick={() =>
                                      setModal({ entity: "habit", item: h })
                                    }
                                  >
                                    <span style={{ color: h.color }}>
                                      {h.icon}
                                    </span>{" "}
                                    {h.title}
                                  </button>
                                </th>
                                {dates.map((d) => {
                                  const applicable =
                                    scheduled(h, d) ||
                                    records.has(recordId(h.id, d));
                                  const status =
                                    records.get(recordId(h.id, d))?.status ??
                                    "pending";
                                  return (
                                    <td
                                      key={d}
                                      className={
                                        d === today() ? "today-col" : ""
                                      }
                                    >
                                      {applicable ? (
                                        <button
                                          className={"grid-cell " + status}
                                          title={`${h.title} · ${d}: ${status}. Click to cycle; right click for missed.`}
                                          aria-label={`${h.title} on ${d}: ${status}. Click to cycle status`}
                                          onClick={() =>
                                            setStatus(
                                              h,
                                              d,
                                              status === "pending"
                                                ? "completed"
                                                : status === "completed"
                                                  ? "missed"
                                                  : status === "missed"
                                                    ? "skipped"
                                                    : status === "skipped"
                                                      ? "na"
                                                      : "pending",
                                            )
                                          }
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            setStatus(h, d, "missed");
                                          }}
                                        >
                                          {status === "completed"
                                            ? "✓"
                                            : status === "missed"
                                              ? "×"
                                              : status === "skipped"
                                                ? "–"
                                                : status === "na"
                                                  ? "·"
                                                  : ""}
                                        </button>
                                      ) : (
                                        <span className="not-due">·</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="rate-cell">
                                  {habitRate(h, data.records, dates)}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="grid-hint">
                      Click a date cell to cycle: pending → ✓ completed → ×
                      missed → skipped → N/A. Right click marks missed. On
                      mobile, use Day view for large buttons.
                    </p>
                    {view === "day" && (
                      <div className="mobile-day-list">
                        {due.map((h) => (
                          <div className="habit-line" key={h.id}>
                            <div className="habit-identity">
                              <span
                                className="habit-icon"
                                style={{
                                  background: h.color + "22",
                                  color: h.color,
                                }}
                              >
                                {h.icon}
                              </span>
                              <strong>{h.title}</strong>
                            </div>
                            <StatusButtons
                              status={
                                records.get(recordId(h.id, date))?.status ??
                                "pending"
                              }
                              onSet={(s) => setStatus(h, date, s)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Empty
                    title="Your tracker starts here"
                    body="Create a habit, and its calendar will appear here."
                    action={
                      <button
                        className="button primary"
                        onClick={() => setModal({ entity: "habit" })}
                      >
                        Add a habit
                      </button>
                    }
                  />
                )}
              </section>
              <section className="card manage-card">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">SHAPE YOUR ROUTINE</span>
                    <h2>Manage habits</h2>
                  </div>
                </div>
                {[...data.habits]
                  .sort((a, b) => a.order - b.order)
                  .map((h) => (
                    <div className="manage-row" key={h.id}>
                      <span
                        className="habit-icon"
                        style={{ background: h.color + "22", color: h.color }}
                      >
                        {h.icon}
                      </span>
                      <div className="grow">
                        <strong>{h.title}</strong>
                        <small>
                          {h.category} · {h.frequency}
                          {h.archived ? " · Archived" : ""}
                        </small>
                      </div>
                      <button
                        className="subtle"
                        onClick={() => moveHabit(h, -1)}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="subtle"
                        onClick={() => moveHabit(h, 1)}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="subtle"
                        onClick={() => setModal({ entity: "habit", item: h })}
                      >
                        Edit
                      </button>
                      <button
                        className="subtle"
                        onClick={() =>
                          write("habits", { ...h, archived: !h.archived })
                        }
                        title={h.archived ? "Restore" : "Archive"}
                      >
                        {h.archived ? (
                          <RotateCcw size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </button>
                      <button
                        className="subtle"
                        title="Duplicate"
                        onClick={() =>
                          write("habits", {
                            ...h,
                            id: uid(),
                            title: h.title + " copy",
                            order: Date.now(),
                            createdAt: stamp(),
                            archived: false,
                          })
                        }
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="subtle danger"
                        title="Delete"
                        onClick={() => del("habits", h.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </section>
            </>
          )}
          {page === "Planner" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ROOM FOR WHAT MATTERS</span>
                  <h1>Planner & goals</h1>
                  <p>Plan your time. Keep the bigger picture close.</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal({ entity: "goal" })}
                  >
                    <Target size={17} /> New goal
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal({ entity: "task" })}
                  >
                    <Plus size={17} /> New task
                  </button>
                </div>
              </div>
              <div className="planner-grid">
                <section className="card">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">YOUR SCHEDULE</span>
                      <h2>{dayLabel(date)}</h2>
                    </div>
                    <input
                      aria-label="Planner date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="quick-week">
                    {weekDays(date, profile?.weekStart ?? 1).map((d) => (
                      <button
                        key={d}
                        className={d === date ? "selected" : ""}
                        onClick={() => setDate(d)}
                      >
                        <small>{dayLabel(d, { weekday: "short" })}</small>
                        <strong>{parseDate(d).getDate()}</strong>
                      </button>
                    ))}
                  </div>
                  {tasks.length ? (
                    tasks.map((t) => (
                      <div className="planner-task" key={t.id}>
                        <button
                          className={"task-check " + (t.done ? "done" : "")}
                          onClick={() =>
                            write("tasks", { ...t, done: !t.done })
                          }
                          aria-label={
                            t.done ? "Uncomplete task" : "Complete task"
                          }
                        >
                          {t.done && <Check size={15} />}
                        </button>
                        <span className="task-time">{t.time || "Anytime"}</span>
                        <div className="grow">
                          <strong className={t.done ? "struck" : ""}>
                            {t.title}
                          </strong>
                          <small>
                            {t.minutes ? `${t.minutes} min · ` : ""}
                            {t.priority} priority
                            {t.notes ? " · " + t.notes : ""}
                          </small>
                        </div>
                        <button
                          className="subtle"
                          onClick={() => setModal({ entity: "task", item: t })}
                        >
                          Edit
                        </button>
                        <button
                          className="subtle danger"
                          aria-label="Delete task"
                          onClick={() => del("tasks", t.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="A fresh page"
                      body="Add a task or choose another day to see your schedule."
                      action={
                        <button
                          className="button secondary"
                          onClick={() => setModal({ entity: "task" })}
                        >
                          Add a task
                        </button>
                      }
                    />
                  )}
                  <button
                    className="inline-add"
                    onClick={() => setModal({ entity: "task" })}
                  >
                    <Plus size={16} /> Add task
                  </button>
                </section>
                <div className="stack">
                  <section className="card">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">COMING UP</span>
                        <h2>Unfinished tasks</h2>
                      </div>
                    </div>
                    {data.tasks
                      .filter((t) => !t.done && t.date < today())
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 5)
                      .map((t) => (
                        <div className="upcoming" key={t.id}>
                          <div className="grow">
                            <strong>{t.title}</strong>
                            <small>
                              {dayLabel(t.date, {
                                month: "short",
                                day: "numeric",
                              })}
                            </small>
                          </div>
                          <button
                            className="subtle"
                            onClick={() =>
                              write("tasks", { ...t, date: today() })
                            }
                          >
                            Move to today
                          </button>
                        </div>
                      ))}
                    {data.tasks.filter((t) => !t.done && t.date < today())
                      .length === 0 && (
                      <p className="quiet">Nothing to carry over. Nice work.</p>
                    )}
                  </section>
                  <section className="card">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">THE LONG VIEW</span>
                        <h2>Goals</h2>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setModal({ entity: "goal" })}
                        aria-label="Add goal"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    {data.goals.length ? (
                      data.goals.map((g) => (
                        <div className="goal-item" key={g.id}>
                          <div className="goal-title">
                            <strong>{g.title}</strong>
                            <button
                              className="subtle"
                              onClick={() =>
                                setModal({ entity: "goal", item: g })
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="subtle danger"
                              onClick={() => del("goals", g.id)}
                              aria-label="Delete goal"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <small>
                            {g.current} / {g.target} {g.unit}
                            {g.relatedHabitId
                              ? " · " +
                                (habits.find((h) => h.id === g.relatedHabitId)
                                  ?.title ?? "Linked habit")
                              : ""}
                            {g.deadline
                              ? " · Due " +
                                dayLabel(g.deadline, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : ""}
                          </small>
                          <div className="bar">
                            <i
                              style={{
                                width: `${Math.min(100, (g.current / g.target) * 100)}%`,
                              }}
                            />
                          </div>
                          <div className="stepper">
                            <button
                              onClick={() =>
                                write("goals", {
                                  ...g,
                                  current: Math.max(0, g.current - 1),
                                })
                              }
                            >
                              −
                            </button>
                            <span>
                              {Math.min(
                                100,
                                Math.round((g.current / g.target) * 100),
                              )}
                              % · {g.status}
                            </span>
                            <button
                              onClick={() =>
                                write("goals", {
                                  ...g,
                                  current: Math.min(g.target, g.current + 1),
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="quiet">
                        Goals give your daily effort a direction.
                      </p>
                    )}
                  </section>
                </div>
              </div>
              <section className="card review-card">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">CHECK IN WITH YOURSELF</span>
                    <h2>Daily review</h2>
                  </div>
                </div>
                <ReviewForm
                  value={data.reviews.find((r) => r.id === date)}
                  date={date}
                  onSave={(r) => write("reviews", r)}
                />
              </section>
            </>
          )}
          {(page === "Meals" || page === "Training") && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {page === "Meals"
                      ? "NOURISH YOUR WEEK"
                      : "MOVE WITH INTENTION"}
                  </span>
                  <h1>{page === "Meals" ? "Meal plan" : "Training plan"}</h1>
                  <p>
                    {page === "Meals"
                      ? "Your own flexible weekly menu."
                      : "Build a week of movement that fits your life."}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    setModal({ entity: page === "Meals" ? "meal" : "workout" })
                  }
                >
                  <Plus size={17} />{" "}
                  {page === "Meals" ? "Add meal" : "Add session"}
                </button>
              </div>
              <div className="week-layout">
                {weekDays(date, profile?.weekStart ?? 1).map((d) => {
                  const day = dayOfWeek(d);
                  const items =
                    page === "Meals"
                      ? data.meals
                          .filter((m) => m.day === day)
                          .sort((a, b) => a.order - b.order)
                      : data.workouts
                          .filter((w) => w.day === day)
                          .sort((a, b) => a.order - b.order);
                  return (
                    <section
                      className={
                        "card week-card " + (d === today() ? "is-today" : "")
                      }
                      key={d}
                    >
                      <div className="week-title">
                        <div>
                          <span className="eyebrow">
                            {d === today() ? "TODAY" : "WEEKLY PLAN"}
                          </span>
                          <h2>{weekdays[day]}</h2>
                          <small>
                            {dayLabel(d, { month: "short", day: "numeric" })}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Add to ${weekdays[day]}`}
                          onClick={() =>
                            setModal({
                              entity: page === "Meals" ? "meal" : "workout",
                              item:
                                page === "Meals"
                                  ? newMeal(day)
                                  : newWorkout(day),
                            })
                          }
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      {items.length ? (
                        items.map((item) => (
                          <div className="week-item" key={item.id}>
                            <div className="week-item-top">
                              <span className="tag">
                                {"category" in item
                                  ? item.category
                                  : item.restDay
                                    ? "Rest day"
                                    : item.muscle || "Session"}
                              </span>
                              <span>
                                {"time" in item && item.time
                                  ? item.time
                                  : "duration" in item && item.duration
                                    ? `${item.duration} min`
                                    : ""}
                              </span>
                            </div>
                            <h3>
                              {item.title ||
                                ("restDay" in item && item.restDay
                                  ? "Rest day"
                                  : "Untitled")}
                            </h3>
                            <p>
                              {"quantity" in item
                                ? item.quantity || `${item.calories || 0} kcal`
                                : (item.exercises || item.notes).slice(0, 90)}
                            </p>
                            <div className="week-item-foot">
                              <StatusButtons
                                compact
                                status={getPlanStatus(
                                  page === "Meals" ? "meal" : "workout",
                                  item.id,
                                  d,
                                )}
                                onSet={(s) =>
                                  setPlanStatus(
                                    page === "Meals" ? "meal" : "workout",
                                    item.id,
                                    d,
                                    s,
                                  )
                                }
                              />
                              <button
                                className="subtle"
                                onClick={() =>
                                  setModal({
                                    entity:
                                      page === "Meals" ? "meal" : "workout",
                                    item,
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="subtle"
                                title="Duplicate"
                                onClick={() =>
                                  write(
                                    page === "Meals" ? "meals" : "workouts",
                                    { ...item, id: uid(), order: Date.now() },
                                  )
                                }
                              >
                                <Copy size={15} />
                              </button>
                              <button
                                className="subtle danger"
                                title="Delete"
                                onClick={() =>
                                  del(
                                    page === "Meals" ? "meals" : "workouts",
                                    item.id,
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="quiet">Nothing planned yet.</p>
                      )}
                    </section>
                  );
                })}
              </div>
              <p className="footnote">
                Your weekly plan repeats. Completion is recorded separately for
                each calendar date.
              </p>
            </>
          )}
          {page === "Insights" && (
            <Insights
              data={data}
              habits={data.habits}
              date={date}
              setDate={setDate}
            />
          )}
          {page === "Settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h1>Settings</h1>
                  <p>Personalize your space and manage your data.</p>
                </div>
              </div>
              <div className="settings-layout">
                <section className="card settings-card">
                  <h2>Your preferences</h2>
                  <Field label="Display name">
                    <input
                      value={profile?.displayName ?? ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...defaultProfile(),
                          ...p,
                          displayName: e.target.value,
                        }))
                      }
                      onBlur={() =>
                        profile &&
                        saveProfile(user.uid, profile).catch((e) =>
                          toast(e.message),
                        )
                      }
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Appearance">
                      <select
                        value={profile?.theme ?? "system"}
                        onChange={(e) => {
                          const p = {
                            ...defaultProfile(),
                            ...profile,
                            theme: e.target.value as Profile["theme"],
                          };
                          setProfile(p);
                          saveProfile(user.uid, p).catch((x) =>
                            toast(x.message),
                          );
                        }}
                      >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </Field>
                    <Field label="Week starts on">
                      <select
                        value={profile?.weekStart ?? 1}
                        onChange={(e) => {
                          const p = {
                            ...defaultProfile(),
                            ...profile,
                            weekStart: Number(e.target.value) as 0 | 1,
                          };
                          setProfile(p);
                          saveProfile(user.uid, p).catch((x) =>
                            toast(x.message),
                          );
                        }}
                      >
                        <option value="1">Monday</option>
                        <option value="0">Sunday</option>
                      </select>
                    </Field>
                    <Field label="Time format">
                      <select
                        value={profile?.timeFormat ?? "12"}
                        onChange={(e) => {
                          const p = {
                            ...defaultProfile(),
                            ...profile,
                            timeFormat: e.target.value as "12" | "24",
                          };
                          setProfile(p);
                          saveProfile(user.uid, p).catch((x) =>
                            toast(x.message),
                          );
                        }}
                      >
                        <option value="12">12 hour</option>
                        <option value="24">24 hour</option>
                      </select>
                    </Field>
                  </div>
                  <p className="quiet">
                    Signed in as {user.email} ·{" "}
                    {user.emailVerified ? "Email verified" : "Email unverified"}
                  </p>
                  {!user.emailVerified && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        sendEmailVerification(user)
                          .then(() => toast("Verification email sent."))
                          .catch((e) => toast(e.message))
                      }
                    >
                      Resend verification email
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => signOut(auth)}
                  >
                    <LogOut size={17} /> Sign out
                  </button>
                </section>
                <section className="card settings-card">
                  <h2>Your data</h2>
                  <p>
                    Download a JSON backup of your account. Import merges
                    records with matching IDs. Keep your backup private.
                  </p>
                  <div className="settings-actions">
                    <button
                      className="button secondary"
                      disabled={busy || !online}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const content = await exportAll(user.uid);
                          const url = URL.createObjectURL(
                            new Blob([JSON.stringify(content, null, 2)], {
                              type: "application/json",
                            }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `daymark-backup-${today()}.json`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        } catch (e) {
                          toast((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Download size={17} /> Export backup
                    </button>
                    <label className="button secondary import-button">
                      Import JSON
                      <input
                        type="file"
                        accept="application/json,.json"
                        disabled={busy || !online}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setBusy(true);
                          try {
                            const content = JSON.parse(await f.text());
                            if (
                              !window.confirm(
                                "Merge this backup into your account? Matching IDs will be overwritten.",
                              )
                            )
                              return;
                            await importData(user.uid, content);
                            toast("Backup imported.");
                          } catch (x) {
                            toast((x as Error).message);
                          } finally {
                            setBusy(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="danger-zone">
                    <h3>Delete account and data</h3>
                    <p>
                      This removes all your Daymark records, profile and sign-in
                      account. Export a backup first if needed. Firebase may
                      require you to sign in again before deletion.
                    </p>
                    <button
                      className="button danger-button"
                      disabled={busy || !online}
                      onClick={async () => {
                        if (
                          prompt(
                            "Type DELETE to permanently remove your account",
                          ) !== "DELETE"
                        )
                          return;
                        const password = prompt(
                          "Enter your password to confirm account deletion",
                        );
                        if (!password || !user.email) return;
                        setBusy(true);
                        try {
                          await reauthenticateWithCredential(
                            user,
                            EmailAuthProvider.credential(user.email, password),
                          );
                          await eraseData(user.uid);
                          await deleteUser(user);
                          toast("Account deleted.");
                        } catch (e) {
                          toast(
                            `Deletion could not finish: ${(e as Error).message}. Sign in again and retry; if records were removed but sign-in remains, retry the deletion.`,
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 size={17} /> Delete account
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.slice(0, 5).map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => navTo(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
        <button onClick={() => setMenuOpen(true)}>
          <ChevronDown size={21} />
          <span>More</span>
        </button>
      </nav>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {modal && (
        <EntityModal
          entity={modal.entity}
          initial={modal.item}
          date={date}
          habits={habits}
          onClose={() => setModal(null)}
          onSave={async (name, item) => {
            void write(name, item);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
function ReviewForm({
  value,
  date,
  onSave,
}: {
  value?: Review;
  date: string;
  onSave: (r: Review) => void;
}) {
  const [form, setForm] = useState<Review>(
    value ?? {
      id: date,
      date,
      mood: 3,
      energy: 3,
      sleep: 0,
      notes: "",
      wins: "",
    },
  );
  useEffect(
    () =>
      setForm(
        value ?? {
          id: date,
          date,
          mood: 3,
          energy: 3,
          sleep: 0,
          notes: "",
          wins: "",
        },
      ),
    [date, value],
  );
  return (
    <div className="review-form">
      <div className="form-grid">
        <Field label="Mood">
          <select
            value={form.mood}
            onChange={(e) => setForm({ ...form, mood: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </Field>
        <Field label="Energy">
          <select
            value={form.energy}
            onChange={(e) =>
              setForm({ ...form, energy: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sleep (hours)">
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={form.sleep}
            onChange={(e) =>
              setForm({ ...form, sleep: Number(e.target.value) })
            }
          />
        </Field>
      </div>
      <Field label="What went well?">
        <input
          value={form.wins}
          onChange={(e) => setForm({ ...form, wins: e.target.value })}
          placeholder="A small win is enough"
        />
      </Field>
      <Field label="Notes for future you">
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <button className="button secondary" onClick={() => onSave(form)}>
        Save review
      </button>
    </div>
  );
}
function Insights({
  data,
  habits,
  date,
  setDate,
}: {
  data: DataState;
  habits: Habit[];
  date: string;
  setDate: (s: string) => void;
}) {
  const dates = monthDays(date).filter((d) => d <= today());
  const s = summary(habits, data.records, dates),
    prior = monthDays(shiftDate(firstOfMonth(date), -1)).filter(
      (d) => d <= today(),
    ),
    priorSummary = summary(habits, data.records, prior);
  const chart = dates.map((d) => ({
    day: String(parseDate(d).getDate()),
    rate: summary(habits, data.records, [d]).rate,
  }));
  const perHabit = habits
    .map((h) => ({
      h,
      rate: habitRate(h, data.records, dates),
      ...streak(h, data.records),
    }))
    .sort((a, b) => b.rate - a.rate);
  const workouts = data.planRecords.filter(
    (r) =>
      r.kind === "workout" &&
      r.status === "completed" &&
      dates.includes(r.date),
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNDERSTAND YOUR PATTERNS</span>
          <h1>Your progress</h1>
          <p>Honest numbers, drawn from the days you've recorded.</p>
        </div>
        <input
          type="month"
          aria-label="Analytics month"
          value={date.slice(0, 7)}
          onChange={(e) => e.target.value && setDate(e.target.value + "-01")}
        />
      </div>
      <div className="metric-grid">
        <div className="metric card">
          <span>HABIT CONSISTENCY</span>
          <strong>{s.rate}%</strong>
          <small>
            {s.completed} complete of {s.eligible} scheduled
          </small>
        </div>
        <div className="metric card">
          <span>LAST MONTH</span>
          <strong>{priorSummary.rate}%</strong>
          <small>
            {s.rate - priorSummary.rate >= 0 ? "+" : ""}
            {s.rate - priorSummary.rate} points this month
          </small>
        </div>
        <div className="metric card">
          <span>MISSED / SKIPPED</span>
          <strong>
            {s.missed} <em>/ {s.skipped}</em>
          </strong>
          <small>Only explicit misses count as missed</small>
        </div>
        <div className="metric card">
          <span>WORKOUTS DONE</span>
          <strong>{workouts}</strong>
          <small>In the selected month</small>
        </div>
      </div>
      <div className="analytics-grid">
        <section className="card chart-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">DAY BY DAY</span>
              <h2>Completion trend</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#57967a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#57967a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e5e9e2" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#38785f"
                  strokeWidth={3}
                  fill="url(#areaFill)"
                  name="Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {!dates.length && (
            <p className="quiet">
              Choose a current or past month to see a trend.
            </p>
          )}
        </section>
        <section className="card chart-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">THE BIG PICTURE</span>
              <h2>Habit consistency</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={perHabit
                  .slice(0, 8)
                  .map((x) => ({
                    name:
                      x.h.title.length > 12
                        ? x.h.title.slice(0, 12) + "…"
                        : x.h.title,
                    rate: x.rate,
                  }))}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <CartesianGrid horizontal={false} stroke="#e5e9e2" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={95}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar
                  dataKey="rate"
                  fill="#d7a876"
                  radius={[0, 5, 5, 0]}
                  name="Completed"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">BY HABIT</span>
            <h2>Where you're growing</h2>
          </div>
        </div>
        {perHabit.length ? (
          perHabit.map((x) => (
            <div className="analysis-row" key={x.h.id}>
              <div className="grow">
                <strong>
                  <span style={{ color: x.h.color }}>{x.h.icon}</span>{" "}
                  {x.h.title}
                </strong>
                <small>
                  Current streak {x.current} · Longest {x.longest} days
                </small>
              </div>
              <div className="bar">
                <i style={{ width: `${x.rate}%` }} />
              </div>
              <strong>{x.rate}%</strong>
            </div>
          ))
        ) : (
          <Empty
            title="Insights grow with you"
            body="Track your first habit to see trends and streaks here."
          />
        )}
      </section>
      <p className="footnote">
        Pending days lower completion rate; skipped and N/A days are excluded.
        Streaks ignore intentionally skipped days. Analytics use saved records
        only.
      </p>
    </>
  );
}
function EntityModal({
  entity,
  initial,
  date,
  habits,
  onClose,
  onSave,
}: {
  entity: Entity;
  initial?: Habit | Task | Goal | Meal | Workout;
  date: string;
  habits: Habit[];
  onClose: () => void;
  onSave: (
    name: CollectionName,
    item: Habit | Task | Goal | Meal | Workout,
  ) => Promise<void>;
}) {
  const [form, setForm] = useState<any>(
    initial ??
      (entity === "habit"
        ? newHabit()
        : entity === "task"
          ? newTask(date)
          : entity === "goal"
            ? newGoal()
            : entity === "meal"
              ? newMeal(dayOfWeek(date))
              : newWorkout(dayOfWeek(date))),
  );
  const set = (key: string, value: unknown) =>
    setForm((p: any) => ({ ...p, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    void onSave(
      (
        {
          habit: "habits",
          task: "tasks",
          goal: "goals",
          meal: "meals",
          workout: "workouts",
        } as Record<Entity, CollectionName>
      )[entity],
      { ...form, title: form.title.trim() },
    );
  };
  return (
    <Modal
      title={`${initial?.title ? "Edit" : "Add"} ${entity}`}
      onClose={onClose}
    >
      <form className="entity-form" onSubmit={submit}>
        <Field label={entity === "workout" ? "Session name" : "Name"}>
          <input
            autoFocus
            required
            maxLength={100}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={
              entity === "habit"
                ? "e.g. Read for 20 minutes"
                : entity === "meal"
                  ? "e.g. Oatmeal and fruit"
                  : "Give it a name"
            }
          />
        </Field>
        {entity === "habit" && (
          <>
            <div className="form-grid">
              <Field label="Category">
                <input
                  maxLength={40}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                />
              </Field>
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  <option value="binary">Yes / No</option>
                  <option value="count">Count</option>
                  <option value="duration">Duration</option>
                  <option value="numeric">Numeric target</option>
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Target">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  value={form.target}
                  onChange={(e) => set("target", Number(e.target.value))}
                />
              </Field>
              <Field label="Unit">
                <input
                  maxLength={24}
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  placeholder="pages, minutes…"
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Repeat">
                <select
                  value={form.frequency}
                  onChange={(e) => set("frequency", e.target.value)}
                >
                  <option value="daily">Every day</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekends">Weekends</option>
                  <option value="custom">Custom days</option>
                </select>
              </Field>
              <Field label="Preferred time">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            </div>
            {form.frequency === "custom" && (
              <div className="day-pills">
                {weekdays.map((day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={form.days.includes(i)}
                      onChange={() =>
                        set(
                          "days",
                          form.days.includes(i)
                            ? form.days.filter((x: number) => x !== i)
                            : [...form.days, i],
                        )
                      }
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            )}
            <div className="form-grid">
              <Field label="Start date">
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>
              <Field label="End date (optional)">
                <input
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Icon">
              <div className="pickers">
                {iconOptions.map((icon) => (
                  <button
                    type="button"
                    key={icon}
                    className={form.icon === icon ? "selected" : ""}
                    onClick={() => set("icon", icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Color">
              <div className="pickers">
                {colors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={color}
                    className={form.color === color ? "selected" : ""}
                    style={{ background: color, color: "white" }}
                    onClick={() => set("color", color)}
                  >
                    {form.color === color ? "✓" : ""}
                  </button>
                ))}
              </div>
            </Field>
            <label className="toggle">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
              />{" "}
              Enabled
            </label>
          </>
        )}
        {entity === "task" && (
          <>
            <div className="form-grid">
              <Field label="Date">
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
              <Field label="Time">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => set("priority", e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <Field label="Estimated minutes">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={form.minutes}
                  onChange={(e) => set("minutes", Number(e.target.value))}
                />
              </Field>
            </div>
          </>
        )}
        {entity === "goal" && (
          <>
            <Field label="Description">
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Target">
                <input
                  type="number"
                  required
                  min="1"
                  value={form.target}
                  onChange={(e) => set("target", Number(e.target.value))}
                />
              </Field>
              <Field label="Current progress">
                <input
                  type="number"
                  min="0"
                  max={form.target}
                  value={form.current}
                  onChange={(e) => set("current", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Unit">
                <input
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  placeholder="hours, books…"
                />
              </Field>
              <Field label="Deadline">
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Milestone">
              <input
                value={form.milestone}
                onChange={(e) => set("milestone", e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Related habit">
                <select
                  value={form.relatedHabitId}
                  onChange={(e) => set("relatedHabitId", e.target.value)}
                >
                  <option value="">None</option>
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
            </div>
          </>
        )}
        {(entity === "meal" || entity === "workout") && (
          <>
            <div className="form-grid">
              <Field label="Day of week">
                <select
                  value={form.day}
                  onChange={(e) => set("day", Number(e.target.value))}
                >
                  {weekdays.map((d, i) => (
                    <option value={i} key={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              {entity === "meal" ? (
                <Field label="Meal category">
                  <input
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    list="meal-categories"
                  />
                  <datalist id="meal-categories">
                    <option>Breakfast</option>
                    <option>Lunch</option>
                    <option>Dinner</option>
                    <option>Snack</option>
                  </datalist>
                </Field>
              ) : (
                <Field label="Muscle group / type">
                  <input
                    value={form.muscle}
                    onChange={(e) => set("muscle", e.target.value)}
                  />
                </Field>
              )}
            </div>
            {entity === "meal" ? (
              <>
                <div className="form-grid">
                  <Field label="Time">
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => set("time", e.target.value)}
                    />
                  </Field>
                  <Field label="Quantity">
                    <input
                      value={form.quantity}
                      onChange={(e) => set("quantity", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="form-grid four">
                  {(["calories", "protein", "carbs", "fat"] as const).map(
                    (key) => (
                      <Field
                        key={key}
                        label={key === "calories" ? "kcal" : key + " (g)"}
                      >
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={form[key]}
                          onChange={(e) => set(key, Number(e.target.value))}
                        />
                      </Field>
                    ),
                  )}
                </div>
              </>
            ) : (
              <>
                <Field label="Exercises (one per line; sets × reps × weight, rest as needed)">
                  <textarea
                    rows={5}
                    value={form.exercises}
                    onChange={(e) => set("exercises", e.target.value)}
                    placeholder="Squat — 3 × 8 · 60 kg · 90s rest"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Duration (minutes)">
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={form.duration}
                      onChange={(e) => set("duration", Number(e.target.value))}
                    />
                  </Field>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.restDay}
                      onChange={(e) => set("restDay", e.target.checked)}
                    />{" "}
                    Rest day
                  </label>
                </div>
              </>
            )}
          </>
        )}
        {!["goal"].includes(entity) && (
          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save {entity}</button>
        </div>
      </form>
    </Modal>
  );
}
export default App;
