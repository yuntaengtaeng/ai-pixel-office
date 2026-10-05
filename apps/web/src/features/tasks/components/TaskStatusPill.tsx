import type { Task } from "@ai-pixel-office/domain/entities";
import { REQUEST_STATE } from "../../../shared/config/presentation.ts";
import { Pill } from "../../../shared/ui/Pill.tsx";
import { requestStateOf } from "../utils/requestState.ts";

/** 기안서 상태 라벨 */
export function TaskStatusPill({ task }: { task: Pick<Task, "status" | "queuedBehind"> }) {
  const state = REQUEST_STATE[requestStateOf(task)];
  return <Pill color={state.color}>{state.label}</Pill>;
}
