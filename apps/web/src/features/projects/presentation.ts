import type { Project } from "../../../../../packages/domain/src/entities.ts";

export function projectStatusLabel(status: Project["status"]): string {
  if (status === "active") return "진행 중";
  if (status === "paused") return "잠시 멈춤";
  return "완료";
}
