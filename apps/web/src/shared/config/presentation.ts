import type {
  AgentModel,
  AgentPermissions,
  Task,
  TaskStatus,
} from "@ai-pixel-office/domain/entities";

export const RUNTIME: Record<AgentModel, { label: string; color: string }> = {
  claude: { label: "Claude", color: "#72549a" },
  codex: { label: "Codex", color: "#397861" },
};

export const STATUS: Record<TaskStatus, { label: string; icon: string }> = {
  todo: { label: "할 일", icon: "□" },
  working: { label: "작업 중", icon: "▣" },
  needs_review: { label: "검토 필요", icon: "◇" },
  needs_input: { label: "입력 필요", icon: "?" },
  blocked: { label: "막힘", icon: "!" },
  done: { label: "완료", icon: "✓" },
  failed: { label: "실패", icon: "×" },
};

export const PERMISSIONS: Array<{ key: keyof AgentPermissions; label: string }> = [
  { key: "fileRead", label: "파일 읽기" },
  { key: "fileWrite", label: "파일 쓰기" },
  { key: "terminal", label: "터미널" },
  { key: "git", label: "Git" },
  { key: "browser", label: "브라우저" },
  { key: "figma", label: "Figma" },
];

export const PRIORITIES: Record<NonNullable<Task["priority"]>, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};
