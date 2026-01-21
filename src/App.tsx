import React, { useEffect, useMemo, useState } from "react";
import { AppState, Category, ISODate, RecurrenceRule, Task } from "./types";
import { loadState, resetState, saveState } from "./lib/storage";
import {
  addGoal,
  addTask,
  completeTask,
  deleteGoal,
  deleteTask,
  ensureTodayGoalLogs,
  getAnytime,
  getDueToday,
  getOverdue,
  goalsForToday,
  toggleGoalForToday,
  todayISO,
  updateGoal,
  updateTask,
} from "./lib/logic";
import { formatNice, fromISODate, toISODate } from "./lib/date";
import { computeInitialDueDate } from "./lib/recurrence";

type Tab = "today" | "tasks" | "settings";

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Icon({ name }: { name: "home" | "list" | "gear" | "plus" | "x" }) {
  const common = "w-5 h-5";
  if (name === "plus")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  if (name === "x")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  if (name === "list")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  if (name === "gear")
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />
        <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4.7a8 8 0 0 0-1.7-1l-.4-2.5H9.9l-.4 2.5a8 8 0 0 0-1.7 1L5.4 9 3.4 12.5l2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.7a8 8 0 0 0 1.7 1l.4 2.5h4.2l.4-2.5a8 8 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5z" />
      </svg>
    );
  // home
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </svg>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button
            className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{children}</span>;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function recurrenceLabel(task: Task) {
  const r = task.recurrence;
  if (r.kind === "none") return "One-time";
  const unit = r.unit;
  const int = r.interval;

  if (unit === "year" && task.recurrenceMonth) {
    const month = monthNames[task.recurrenceMonth - 1] ?? `Month ${task.recurrenceMonth}`;
    const week = task.recurrenceWeek ? ` (week ${task.recurrenceWeek})` : "";
    if (int === 1) return `Every ${month}${week}`;
    return `Every ${int} years in ${month}${week}`;
  }

  if (unit === "month" && task.recurrenceWeek) {
    if (int === 1) return `Every month (week ${task.recurrenceWeek})`;
    return `Every ${int} months (week ${task.recurrenceWeek})`;
  }

  if (int === 1) return `Every ${unit}`;
  return `Every ${int} ${unit}s`;
}

function plannedLabel(t: Task) {
  if (t.recurrence.kind !== "none") return null;
  if (!t.plannedMonth) return null;
  const month = monthNames[t.plannedMonth - 1] ?? `Month ${t.plannedMonth}`;
  if (t.plannedWeek) return `Planned: ${month} (week ${t.plannedWeek})`;
  return `Planned: ${month}`;
}

function categoryName(categories: Category[], id: string) {
  return categories.find((c) => c.id === id)?.name ?? "Unknown";
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>("today");

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"goal" | "task">("task");

  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  // Use local date on each render (handles day change naturally)
  const today: ISODate = todayISO();
  const niceDate = useMemo(() => formatNice(fromISODate(today)), [today]);

  // Ensure today's goal logs exist
  useEffect(() => {
    setState((s) => ensureTodayGoalLogs(s, today));
  }, [today]);

  // Persist
  useEffect(() => {
    saveState(state);
  }, [state]);

  const goals = useMemo(() => goalsForToday(state, today), [state, today]);
  const goalsDone = goals.filter((x) => x.log?.completed).length;
  const goalsTotal = goals.length;

  const dueToday = useMemo(() => getDueToday(state, today), [state, today]);
  const overdue = useMemo(() => getOverdue(state, today), [state, today]);
  const anytime = useMemo(() => getAnytime(state), [state]);
  const plannedRecurring = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.archived && !t.completedAt)
        .filter((t) => t.recurrence.kind !== "none" && (t.recurrenceMonth || t.recurrenceWeek)),
    [state.tasks]
  );

  const editingTask = useMemo(
    () => state.tasks.find((t) => t.id === editTaskId) ?? null,
    [state.tasks, editTaskId]
  );

  return (
    <div className="h-full bg-gray-50">
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-sm text-gray-500">{niceDate}</div>
          <div className="text-2xl font-bold">{tab === "today" ? "Today" : tab === "tasks" ? "Tasks" : "Settings"}</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 pb-24 space-y-4">
          {tab === "today" && (
            <>
              <Section title="Daily Goals" right={<Pill>{goalsDone}/{goalsTotal} done</Pill>}>
                <div className="space-y-2">
                  {goals.map(({ goal, log }) => (
                    <button
                      key={goal.id}
                      onClick={() => setState((s) => toggleGoalForToday(s, today, goal.id))}
                      className={cls(
                        "w-full flex items-center justify-between p-3 rounded-xl border text-left",
                        log?.completed ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cls(
                            "w-5 h-5 rounded-md border flex items-center justify-center",
                            log?.completed ? "bg-green-600 border-green-600 text-white" : "border-gray-300"
                          )}
                        >
                          {log?.completed ? "✓" : ""}
                        </div>
                        <div className={cls("font-medium", log?.completed && "line-through text-gray-500")}>{goal.title}</div>
                      </div>
                    </button>
                  ))}
                  {goals.length === 0 && <div className="text-sm text-gray-500">No active goals. Add some in Settings.</div>}
                </div>
              </Section>

              <Section title="Due Today" right={<Pill>{dueToday.length} items</Pill>}>
                <div className="space-y-2">
                  {dueToday.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <button
                        onClick={() => setState((s) => completeTask(s, t.id, today))}
                        className="p-3 rounded-xl bg-white border border-gray-200 active:bg-gray-100"
                        aria-label="Complete"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditTaskId(t.id)}
                        className="flex-1 p-3 rounded-xl bg-white border border-gray-200 text-left"
                      >
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-gray-500 flex gap-2 mt-1">
                          <span>{categoryName(state.categories, t.categoryId)}</span>
                          <span>•</span>
                          <span>{recurrenceLabel(t)}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                  {dueToday.length === 0 && <div className="text-sm text-gray-500">Nothing due today.</div>}
                </div>
              </Section>

              {overdue.length > 0 && (
                <Section title="Overdue" right={<Pill>{overdue.length}</Pill>}>
                  <div className="space-y-2">
                    {overdue.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <button
                          onClick={() => setState((s) => completeTask(s, t.id, today))}
                          className="p-3 rounded-xl bg-white border border-gray-200 active:bg-gray-100"
                          aria-label="Complete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditTaskId(t.id)}
                          className="flex-1 p-3 rounded-xl bg-white border border-red-200 text-left"
                        >
                          <div className="font-medium">{t.title}</div>
                          <div className="text-xs text-gray-500 flex gap-2 mt-1">
                            <span>{categoryName(state.categories, t.categoryId)}</span>
                            <span>•</span>
                            <span className="text-red-600">Overdue</span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {tab === "tasks" && (
            <>
              <Section title="All Tasks" right={<Pill>{state.tasks.filter((t) => !t.archived).length}</Pill>}>
                <div className="space-y-2">
                  {state.tasks
                    .filter((t) => !t.archived)
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((t) => {
                      const done = !!t.completedAt;
                      const due = t.recurrence.kind !== "none" ? t.nextDueDate : t.dueDate;
                      const planned = !due ? plannedLabel(t) : null;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setEditTaskId(t.id)}
                          className={cls(
                            "w-full p-3 rounded-xl border text-left bg-white",
                            done ? "border-gray-200 opacity-60" : "border-gray-200"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{t.title}</div>
                            {done && <Pill>Completed</Pill>}
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                            <span>{categoryName(state.categories, t.categoryId)}</span>
                            <span>•</span>
                            <span>{recurrenceLabel(t)}</span>
                            {due && (
                              <>
                                <span>•</span>
                                <span>Due: {due}</span>
                              </>
                            )}
                            {planned && (
                              <>
                                <span>•</span>
                                <span>{planned}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}

                  {state.tasks.filter((t) => !t.archived).length === 0 && (
                    <div className="text-sm text-gray-500">No tasks yet. Add one.</div>
                  )}
                </div>
              </Section>

              <Section title="Planned Recurring">
                <div className="space-y-2">
                  {plannedRecurring.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setEditTaskId(t.id)}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white text-left"
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                        <span>{categoryName(state.categories, t.categoryId)}</span>
                        <span>•</span>
                        <span>{recurrenceLabel(t)}</span>
                        {t.nextDueDate && (
                          <>
                            <span>•</span>
                            <span>Next: {t.nextDueDate}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                  {plannedRecurring.length === 0 && (
                    <div className="text-sm text-gray-500">No planned recurring tasks.</div>
                  )}
                </div>
              </Section>

              <Section title="Anytime (no due date or plan)">
                <div className="space-y-2">
                  {anytime.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setEditTaskId(t.id)}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white text-left"
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500">{categoryName(state.categories, t.categoryId)}</div>
                    </button>
                  ))}
                  {anytime.length === 0 && <div className="text-sm text-gray-500">No anytime tasks.</div>}
                </div>
              </Section>
            </>
          )}

          {tab === "settings" && (
            <>
              <Section title="Daily Goals">
                <div className="space-y-2">
                  {state.goals
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((g) => (
                      <div key={g.id} className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl">
                        <input
                          type="checkbox"
                          checked={g.active}
                          onChange={(e) => setState((s) => updateGoal(s, g.id, { active: e.target.checked }))}
                          className="w-5 h-5"
                        />
                        <input
                          value={g.title}
                          onChange={(e) => setState((s) => updateGoal(s, g.id, { title: e.target.value }))}
                          className="flex-1 bg-transparent outline-none font-medium"
                        />
                        <button
                          onClick={() => setState((s) => deleteGoal(s, g.id))}
                          className="px-3 py-2 rounded-xl bg-gray-100 active:bg-gray-200"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      const title = prompt("New goal title?");
                      if (!title?.trim()) return;
                      setState((s) => addGoal(s, title));
                    }}
                    className="flex-1 py-3 rounded-xl bg-black text-white font-semibold active:opacity-90"
                  >
                    Add Goal
                  </button>
                </div>
              </Section>

              <Section title="Categories (read-only for MVP)">
                <div className="flex flex-wrap gap-2">
                  {state.categories
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((c) => (
                      <Pill key={c.id}>{c.name}</Pill>
                    ))}
                </div>
              </Section>

              <Section title="Danger Zone">
                <button
                  onClick={() => {
                    if (!confirm("Reset all data?")) return;
                    resetState();
                    setState(loadState());
                  }}
                  className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold active:opacity-90"
                >
                  Reset App Data
                </button>
              </Section>
            </>
          )}
        </div>

        {/* Floating Add */}
        <button
          onClick={() => setAddOpen(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-md w-[calc(100%-2rem)] sm:w-[28rem]
                     py-3 rounded-2xl bg-black text-white font-semibold shadow-lg active:opacity-90
                     flex items-center justify-center gap-2"
        >
          <Icon name="plus" /> Quick Add
        </button>

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-md mx-auto px-2 py-2 grid grid-cols-3">
            <TabButton active={tab === "today"} onClick={() => setTab("today")} icon="home" label="Today" />
            <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon="list" label="Tasks" />
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon="gear" label="Settings" />
          </div>
        </div>

        {/* Add Modal */}
        <Modal open={addOpen} title="Quick Add" onClose={() => setAddOpen(false)}>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAddMode("task")}
              className={cls(
                "flex-1 py-2 rounded-xl border font-semibold",
                addMode === "task" ? "bg-black text-white border-black" : "bg-white border-gray-200"
              )}
            >
              Task
            </button>
            <button
              onClick={() => setAddMode("goal")}
              className={cls(
                "flex-1 py-2 rounded-xl border font-semibold",
                addMode === "goal" ? "bg-black text-white border-black" : "bg-white border-gray-200"
              )}
            >
              Daily Goal
            </button>
          </div>

          {addMode === "goal" ? (
            <QuickAddGoal
              onAdd={(title) => {
                setState((s) => addGoal(s, title));
                setAddOpen(false);
              }}
            />
          ) : (
            <QuickAddTask
              categories={state.categories}
              onAdd={(task) => {
                setState((s) => addTask(s, task));
                setAddOpen(false);
              }}
            />
          )}
        </Modal>

        {/* Edit Task Modal */}
        <Modal open={!!editingTask} title="Edit Task" onClose={() => setEditTaskId(null)}>
          {editingTask && (
            <EditTask
              task={editingTask}
              categories={state.categories}
              today={today}
              onSave={(patch) => setState((s) => updateTask(s, editingTask.id, patch))}
              onComplete={() => setState((s) => completeTask(s, editingTask.id, today))}
              onDelete={() => {
                setState((s) => deleteTask(s, editingTask.id));
                setEditTaskId(null);
              }}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: "home" | "list" | "gear";
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cls(
        "py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold",
        active ? "text-black" : "text-gray-400"
      )}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}

function QuickAddGoal({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g., Walk 10k steps"
        className="w-full p-3 rounded-xl border border-gray-200 outline-none"
      />
      <button
        onClick={() => {
          if (!title.trim()) return;
          onAdd(title.trim());
        }}
        className="w-full py-3 rounded-xl bg-black text-white font-semibold active:opacity-90"
      >
        Add Daily Goal
      </button>
    </div>
  );
}

function QuickAddTask({
  categories,
  onAdd,
}: {
  categories: Category[];
  onAdd: (task: Omit<Task, "id" | "createdAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "cat_house");
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ kind: "none" });
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState<"day" | "week" | "month" | "year">("week");
  const [dueDate, setDueDate] = useState<string>("");
  const [plannedMonth, setPlannedMonth] = useState<number | "">("");
  const [plannedWeek, setPlannedWeek] = useState<number | "">("");
  const [recurrenceMonth, setRecurrenceMonth] = useState<number | "">("");
  const [recurrenceWeek, setRecurrenceWeek] = useState<number | "">("");

  const isRecurring = recurrence.kind !== "none";

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g., Mop kitchen"
        className="w-full p-3 rounded-xl border border-gray-200 outline-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-200 bg-white"
        >
          {categories
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        <select
          value={isRecurring ? "recurring" : "one"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "one") setRecurrence({ kind: "none" });
            else setRecurrence({ kind: "every", interval, unit });
          }}
          className="w-full p-3 rounded-xl border border-gray-200 bg-white"
        >
          <option value="one">One-time</option>
          <option value="recurring">Recurring</option>
        </select>
      </div>

      {isRecurring ? (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            min={1}
            value={interval}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value || 1));
              setInterval(n);
              setRecurrence({ kind: "every", interval: n, unit });
            }}
            className="w-full p-3 rounded-xl border border-gray-200 outline-none"
          />
          <select
            value={unit}
            onChange={(e) => {
              const u = e.target.value as any;
              setUnit(u);
              setRecurrence({ kind: "every", interval, unit: u });
              if (u !== "year") setRecurrenceMonth("");
              if (u !== "year" && u !== "month") setRecurrenceWeek("");
            }}
            className="w-full p-3 rounded-xl border border-gray-200 bg-white"
          >
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>

          <div className="text-sm text-gray-500 flex items-center justify-center">
            Every {interval} {unit}
            {interval === 1 ? "" : "s"}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Optional due date</div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => {
              const next = e.target.value;
              setDueDate(next);
              if (next) {
                setPlannedMonth("");
                setPlannedWeek("");
              }
            }}
            className="w-full p-3 rounded-xl border border-gray-200 bg-white"
          />
        </div>
      )}

      {!isRecurring && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Plan month (optional)</div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={plannedMonth}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : "";
                setPlannedMonth(value);
                if (!value) setPlannedWeek("");
                if (value) setDueDate("");
              }}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white"
            >
              <option value="">No month</option>
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={plannedWeek}
              onChange={(e) => setPlannedWeek(e.target.value ? Number(e.target.value) : "")}
              disabled={!plannedMonth}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
            >
              <option value="">Any week</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">Use this instead of a specific due date.</div>
        </div>
      )}

      {isRecurring && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Recurring schedule (optional)</div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={recurrenceMonth}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : "";
                setRecurrenceMonth(value);
                if (!value) setRecurrenceWeek("");
              }}
              disabled={unit !== "year"}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
            >
              <option value="">Any month</option>
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={recurrenceWeek}
              onChange={(e) => setRecurrenceWeek(e.target.value ? Number(e.target.value) : "")}
              disabled={unit === "year" ? !recurrenceMonth : unit !== "month"}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
            >
              <option value="">Any week</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">Set unit to Year(s) to pick a month, or Month(s) to pick a week.</div>
        </div>
      )}

      <button
        onClick={() => {
          if (!title.trim()) return;
          const cleanTitle = title.trim();
          const today = toISODate(new Date()) as any;
          const plannedMonthValue =
            recurrence.kind === "none" && !dueDate && plannedMonth ? Number(plannedMonth) : undefined;
          const plannedWeekValue =
            plannedMonthValue && plannedWeek ? Number(plannedWeek) : undefined;
          const recurrenceMonthValue =
            recurrence.kind !== "none" && unit === "year" && recurrenceMonth
              ? Number(recurrenceMonth)
              : undefined;
          const recurrenceWeekValue =
            recurrence.kind !== "none" && (unit === "month" || (unit === "year" && recurrenceMonth)) && recurrenceWeek
              ? Number(recurrenceWeek)
              : undefined;
          const nextDueDate =
            recurrence.kind !== "none"
              ? computeInitialDueDate(
                  today,
                  { kind: "every", interval, unit },
                  { month: recurrenceMonthValue, week: recurrenceWeekValue }
                ) ?? today
              : undefined;

          const task: Omit<Task, "id" | "createdAt"> = {
            title: cleanTitle,
            categoryId,
            notes: "",
            recurrence:
              recurrence.kind === "none" ? { kind: "none" } : { kind: "every", interval, unit },
            dueDate: recurrence.kind === "none" && dueDate ? (dueDate as any) : undefined,
            plannedMonth: plannedMonthValue,
            plannedWeek: plannedWeekValue,
            nextDueDate,
            recurrenceMonth: recurrenceMonthValue,
            recurrenceWeek: recurrenceWeekValue,
          };

          onAdd(task);
        }}
        className="w-full py-3 rounded-xl bg-black text-white font-semibold active:opacity-90"
      >
        Add Task
      </button>
    </div>
  );
}

function EditTask({
  task,
  categories,
  today,
  onSave,
  onComplete,
  onDelete,
}: {
  task: Task;
  categories: Category[];
  today: ISODate;
  onSave: (patch: Partial<Task>) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const isRecurring = task.recurrence.kind !== "none";
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [plannedMonth, setPlannedMonth] = useState<number | "">(task.plannedMonth ?? "");
  const [plannedWeek, setPlannedWeek] = useState<number | "">(task.plannedWeek ?? "");
  const [recurrenceMonth, setRecurrenceMonth] = useState<number | "">(task.recurrenceMonth ?? "");
  const [recurrenceWeek, setRecurrenceWeek] = useState<number | "">(task.recurrenceWeek ?? "");
  const [interval, setInterval] = useState(isRecurring && task.recurrence.kind !== "none" ? task.recurrence.interval : 1);
  const [unit, setUnit] = useState(isRecurring && task.recurrence.kind !== "none" ? task.recurrence.unit : "week");

  useEffect(() => {
    setTitle(task.title);
    setCategoryId(task.categoryId);
    setDueDate(task.dueDate ?? "");
    setPlannedMonth(task.plannedMonth ?? "");
    setPlannedWeek(task.plannedWeek ?? "");
    setRecurrenceMonth(task.recurrenceMonth ?? "");
    setRecurrenceWeek(task.recurrenceWeek ?? "");
    setInterval(isRecurring && task.recurrence.kind !== "none" ? task.recurrence.interval : 1);
    setUnit(isRecurring && task.recurrence.kind !== "none" ? task.recurrence.unit : "week");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const done = !!task.completedAt;

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-3 rounded-xl border border-gray-200 outline-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-200 bg-white"
        >
          {categories
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 flex items-center justify-center">
          {recurrenceLabel(task)}
        </div>
      </div>

      {!isRecurring && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Due date (optional)</div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => {
              const next = e.target.value;
              setDueDate(next);
              if (next) {
                setPlannedMonth("");
                setPlannedWeek("");
              }
            }}
            className="w-full p-3 rounded-xl border border-gray-200 bg-white"
          />
        </div>
      )}

      {!isRecurring && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Plan month (optional)</div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={plannedMonth}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : "";
                setPlannedMonth(value);
                if (!value) setPlannedWeek("");
                if (value) setDueDate("");
              }}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white"
            >
              <option value="">No month</option>
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={plannedWeek}
              onChange={(e) => setPlannedWeek(e.target.value ? Number(e.target.value) : "")}
              disabled={!plannedMonth}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
            >
              <option value="">Any week</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">Use this instead of a specific due date.</div>
        </div>
      )}

      {isRecurring && task.recurrence.kind !== "none" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setInterval(Math.max(1, Number(e.target.value || 1)))}
            className="w-full p-3 rounded-xl border border-gray-200 outline-none"
          />
          <select
            value={unit}
            onChange={(e) => {
              const next = e.target.value as any;
              setUnit(next);
              if (next !== "year") setRecurrenceMonth("");
              if (next !== "year" && next !== "month") setRecurrenceWeek("");
            }}
            className="w-full p-3 rounded-xl border border-gray-200 bg-white"
          >
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>

          {isRecurring && (
            <>
              <select
                value={recurrenceMonth}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : "";
                  setRecurrenceMonth(value);
                  if (!value) setRecurrenceWeek("");
                }}
                disabled={unit !== "year"}
                className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
              >
                <option value="">Any month</option>
                {monthNames.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={recurrenceWeek}
                onChange={(e) => setRecurrenceWeek(e.target.value ? Number(e.target.value) : "")}
                disabled={unit === "year" ? !recurrenceMonth : unit !== "month"}
                className="w-full p-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60"
              >
                <option value="">Any week</option>
                <option value="1">Week 1</option>
                <option value="2">Week 2</option>
                <option value="3">Week 3</option>
                <option value="4">Week 4</option>
                <option value="5">Week 5</option>
              </select>
            </>
          )}

          <div className="col-span-2 text-xs text-gray-400">
            Set unit to Year(s) to pick a month, or Month(s) to pick a week.
          </div>

          <button
            onClick={() =>
              onSave({
                recurrence: { kind: "every", interval, unit } as any,
                recurrenceMonth: unit === "year" && recurrenceMonth ? Number(recurrenceMonth) : undefined,
                recurrenceWeek:
                  (unit === "month" || (unit === "year" && recurrenceMonth)) && recurrenceWeek
                    ? Number(recurrenceWeek)
                    : undefined,
                nextDueDate: computeInitialDueDate(
                  today,
                  { kind: "every", interval, unit },
                  {
                    month: unit === "year" && recurrenceMonth ? Number(recurrenceMonth) : undefined,
                    week:
                      (unit === "month" || (unit === "year" && recurrenceMonth)) && recurrenceWeek
                        ? Number(recurrenceWeek)
                        : undefined,
                  }
                ),
              })
            }
            className="col-span-2 py-3 rounded-xl bg-gray-900 text-white font-semibold active:opacity-90"
          >
            Update Recurrence
          </button>
        </div>
      )}

      <button
        onClick={() =>
          onSave({
            title: title.trim(),
            categoryId,
            dueDate: dueDate ? (dueDate as any) : undefined,
            plannedMonth: !dueDate && plannedMonth ? Number(plannedMonth) : undefined,
            plannedWeek: !dueDate && plannedMonth && plannedWeek ? Number(plannedWeek) : undefined,
            recurrenceMonth: unit === "year" && recurrenceMonth ? Number(recurrenceMonth) : undefined,
            recurrenceWeek:
              (unit === "month" || (unit === "year" && recurrenceMonth)) && recurrenceWeek
                ? Number(recurrenceWeek)
                : undefined,
          })
        }
        className="w-full py-3 rounded-xl bg-black text-white font-semibold active:opacity-90"
      >
        Save
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={done}
          onClick={onComplete}
          className={cls(
            "py-3 rounded-xl font-semibold",
            done ? "bg-gray-200 text-gray-500" : "bg-green-600 text-white active:opacity-90"
          )}
        >
          {done ? "Completed" : "Complete"}
        </button>
        <button
          onClick={onDelete}
          className="py-3 rounded-xl bg-red-600 text-white font-semibold active:opacity-90"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
