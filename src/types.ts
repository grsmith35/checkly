export type ISODate = `${number}-${number}-${number}`;

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export type RecurrenceRule =
  | { kind: "none" }
  | { kind: "every"; interval: number; unit: RecurrenceUnit };

export type Category = {
  id: string;
  name: string;
  sortOrder: number;
};

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  notes?: string;
  createdAt: number;

  // One-time tasks
  dueDate?: ISODate; // optional

  // Recurring tasks
  recurrence: RecurrenceRule;
  nextDueDate?: ISODate;

  lastCompletedAt?: number;
  completedAt?: number; // for one-time completion
  archived?: boolean;
};

export type GoalDefinition = {
  id: string;
  title: string;
  active: boolean;
  sortOrder: number;
};

export type DailyGoalLog = {
  date: ISODate;
  goalId: string;
  completed: boolean;
  completedAt?: number;
};

export type AppState = {
  version: number;
  categories: Category[];
  tasks: Task[];
  goals: GoalDefinition[];
  goalLogs: DailyGoalLog[];
  settings: {
    strictMode: boolean;
  };
};
