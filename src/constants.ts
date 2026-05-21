export const SUBDIR_MEMORY = "memory";
export const SUBDIR_TASKS = "tasks";
export const SUBDIR_ISSUES = "issues";

export const DEFAULT_MEMORY_DIR = ".local";

export type StandardMemoryFile = {
  fileName: string;
  order: number;
  icon: string;
  label: string;
};

export const STANDARD_MEMORY_FILES: StandardMemoryFile[] = [
  { fileName: "00_spec.md", order: 0, icon: "note", label: "Spec" },
  { fileName: "05_log.md", order: 5, icon: "history", label: "Log" },
  { fileName: "10_task.md", order: 10, icon: "checklist", label: "Task" },
  { fileName: "20_survey.md", order: 20, icon: "search", label: "Survey" },
  { fileName: "30_plan.md", order: 30, icon: "list-ordered", label: "Plan" },
  { fileName: "40_progress.md", order: 40, icon: "pulse", label: "Progress" },
  { fileName: "80_review.md", order: 80, icon: "comment-discussion", label: "Review" },
  { fileName: "90_pr.md", order: 90, icon: "git-pull-request", label: "PR" },
  { fileName: "99_history.md", order: 99, icon: "bookmark", label: "History" },
];

export const STANDARD_MEMORY_FILE_MAP = new Map(STANDARD_MEMORY_FILES.map((f) => [f.fileName, f]));

export const TASK_PLAN_FILE = "00_plan.md";

export const SEVERITIES = ["critical", "major", "minor", "trivial"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  trivial: 3,
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "charts.red",
  major: "charts.orange",
  minor: "charts.yellow",
  trivial: "foreground",
};

export const PERSPECTIVES = ["perf", "sec", "test", "arch", "cq", "docs"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];

export const PERSPECTIVE_META: Record<Perspective, { label: string; icon: string }> = {
  perf: { label: "Performance", icon: "zap" },
  sec: { label: "Security", icon: "shield" },
  test: { label: "Test", icon: "beaker" },
  arch: { label: "Architecture", icon: "type-hierarchy" },
  cq: { label: "Code Quality", icon: "tools" },
  docs: { label: "Documentation", icon: "book" },
};

export const UNKNOWN_GROUP = "unknown";

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

export function isPerspective(value: string): value is Perspective {
  return (PERSPECTIVES as readonly string[]).includes(value);
}
