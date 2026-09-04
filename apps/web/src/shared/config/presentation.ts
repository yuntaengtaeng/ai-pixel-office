import type {
  AgentModel,
  AgentPermissions,
  Task,
  TaskStatus,
} from "@ai-pixel-office/domain/entities";
import { colors } from "@ai-pixel-office/design-token";

export const RUNTIME: Record<AgentModel, { label: string; color: string }> = {
  claude: { label: "Claude", color: colors.runtime.claude },
  codex: { label: "Codex", color: colors.runtime.codex },
};

export const STATUS: Record<TaskStatus, { label: string; icon: string; color: string }> = {
  todo: { label: "할 일", icon: "□", color: colors.status.todo },
  working: { label: "작업 중", icon: "▣", color: colors.status.working },
  needs_review: { label: "검토 필요", icon: "◇", color: colors.status.needsReview },
  needs_input: { label: "입력 필요", icon: "?", color: colors.status.needsInput },
  blocked: { label: "막힘", icon: "!", color: colors.status.blocked },
  done: { label: "완료", icon: "✓", color: colors.status.done },
  failed: { label: "실패", icon: "×", color: colors.status.failed },
};

export const PRIORITY_COLORS: Record<NonNullable<Task["priority"]>, string> = colors.priority;

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
