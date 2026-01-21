import { AppState, DailyGoalLog, GoalDefinition, ISODate, Task } from "../types";
import { isBefore, toISODate } from "./date";
import { computeNextDueDate } from "./recurrence";

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function ensureTodayGoalLogs(state: AppState, today: ISODate): AppState {
  const activeGoals = state.goals.filter((g) => g.active);
  const existingKey = new Set(
    state.goalLogs
      .filter((l) => l.date === today)
      .map((l) => l.goalId)
  );

  const newLogs: DailyGoalLog[] = [];
  for (const g of activeGoals) {
    if (!existingKey.has(g.id)) {
      newLogs.push({ date: today, goalId: g.id, completed: false });
    }
  }
  if (newLogs.length === 0) return state;
  return { ...state, goalLogs: [...state.goalLogs, ...newLogs] };
}

export function toggleGoalForToday(state: AppState, today: ISODate, goalId: string): AppState {
  const nextLogs = state.goalLogs.map((l) => {
    if (l.date !== today || l.goalId !== goalId) return l;
    const nextCompleted = !l.completed;
    return {
      ...l,
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
    };
  });
  return { ...state, goalLogs: nextLogs };
}

export function goalsForToday(state: AppState, today: ISODate) {
  const activeGoals = state.goals
    .filter((g) => g.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const logs = state.goalLogs.filter((l) => l.date === today);
  const byId = new Map(logs.map((l) => [l.goalId, l] as const));
  return activeGoals.map((g) => ({ goal: g, log: byId.get(g.id) }));
}

export function addGoal(state: AppState, title: string): AppState {
  const maxSort = Math.max(0, ...state.goals.map((g) => g.sortOrder));
  const id = `g_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const goal: GoalDefinition = {
    id,
    title: title.trim(),
    active: true,
    sortOrder: maxSort + 1,
  };
  return { ...state, goals: [...state.goals, goal] };
}

export function updateGoal(state: AppState, goalId: string, patch: Partial<GoalDefinition>): AppState {
  return {
    ...state,
    goals: state.goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g)),
  };
}

export function deleteGoal(state: AppState, goalId: string): AppState {
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== goalId),
    goalLogs: state.goalLogs.filter((l) => l.goalId !== goalId),
  };
}

export function addTask(state: AppState, task: Omit<Task, "id" | "createdAt">): AppState {
  const id = `t_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const createdAt = Date.now();
  return { ...state, tasks: [...state.tasks, { ...task, id, createdAt }] };
}

export function updateTask(state: AppState, taskId: string, patch: Partial<Task>): AppState {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

export function deleteTask(state: AppState, taskId: string): AppState {
  return { ...state, tasks: state.tasks.filter((t) => t.id !== taskId) };
}

export function completeTask(state: AppState, taskId: string, today: ISODate): AppState {
  const nextTasks = state.tasks.map((t) => {
    if (t.id !== taskId) return t;

    // Recurring
    if (t.recurrence.kind !== "none" && t.nextDueDate) {
      const nextDue = computeNextDueDate(t.nextDueDate, t.recurrence, today, {
        month: t.recurrenceMonth,
        week: t.recurrenceWeek,
      });
      return {
        ...t,
        lastCompletedAt: Date.now(),
        nextDueDate: nextDue,
      };
    }

    // One-time
    return { ...t, completedAt: Date.now() };
  });

  return { ...state, tasks: nextTasks };
}

export function getDueToday(state: AppState, today: ISODate) {
  return state.tasks
    .filter((t) => !t.archived)
    .filter((t) => {
      if (t.completedAt) return false;
      if (t.recurrence.kind !== "none") return t.nextDueDate === today;
      return t.dueDate === today;
    });
}

export function getOverdue(state: AppState, today: ISODate) {
  return state.tasks
    .filter((t) => !t.archived)
    .filter((t) => {
      if (t.completedAt) return false;
      const due = t.recurrence.kind !== "none" ? t.nextDueDate : t.dueDate;
      return !!due && isBefore(due, today);
    });
}

export function getAnytime(state: AppState) {
  return state.tasks
    .filter((t) => !t.archived)
    .filter(
      (t) =>
        t.recurrence.kind === "none" &&
        !t.dueDate &&
        !t.plannedMonth &&
        !t.completedAt
    );
}
