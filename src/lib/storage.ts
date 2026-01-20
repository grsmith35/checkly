import { AppState, Task } from "../types";
import { toISODate } from "./date";

const KEY = "checkly_state_v1";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function seedState(): AppState {
  const now = Date.now();
  const today = toISODate(new Date());

  const categories = [
    { id: "cat_house", name: "House", sortOrder: 1 },
    { id: "cat_personal", name: "Personal", sortOrder: 2 },
    { id: "cat_health", name: "Health", sortOrder: 3 },
    { id: "cat_finance", name: "Finance", sortOrder: 4 },
    { id: "cat_errands", name: "Errands", sortOrder: 5 },
    { id: "cat_other", name: "Other", sortOrder: 6 }
  ];

  const goals = [
    { id: "g1", title: "Workout / Move 30+ min", active: true, sortOrder: 1 },
    { id: "g2", title: "Drink water goal", active: true, sortOrder: 2 },
    { id: "g3", title: "Read 10 pages", active: true, sortOrder: 3 },
    { id: "g4", title: "Eat on plan", active: true, sortOrder: 4 },
    { id: "g5", title: "Plan tomorrow (5 min)", active: true, sortOrder: 5 }
  ];

  const tasks: Task[] = [
    {
      id: uid("t"),
      title: "Take out trash",
      categoryId: "cat_house",
      createdAt: now,
      recurrence: { kind: "every", interval: 1, unit: "week" },
      nextDueDate: today
    },
    {
      id: uid("t"),
      title: "Vacuum main areas",
      categoryId: "cat_house",
      createdAt: now,
      recurrence: { kind: "every", interval: 1, unit: "week" },
      nextDueDate: today
    },
    {
      id: uid("t"),
      title: "Clean bathrooms",
      categoryId: "cat_house",
      createdAt: now,
      recurrence: { kind: "every", interval: 2, unit: "week" },
      nextDueDate: today
    },
    {
      id: uid("t"),
      title: "Replace furnace filter",
      categoryId: "cat_house",
      createdAt: now,
      recurrence: { kind: "every", interval: 3, unit: "month" },
      nextDueDate: today
    },
    {
      id: uid("t"),
      title: "Pay credit card",
      categoryId: "cat_finance",
      createdAt: now,
      recurrence: { kind: "every", interval: 1, unit: "month" },
      nextDueDate: today
    }
  ];

  return {
    version: 1,
    categories,
    tasks,
    goals,
    goalLogs: [],
    settings: { strictMode: false }
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed?.version) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
}
