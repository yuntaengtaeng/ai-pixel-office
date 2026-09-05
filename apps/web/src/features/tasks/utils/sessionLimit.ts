import type { SessionLimitReason } from "../types/execution.ts";

export function sessionLimitFrom(error?: string): SessionLimitReason | undefined {
  const match = error?.match(/^SESSION_LIMIT:(capacity|inactivity|duration):/);
  return match?.[1] as SessionLimitReason | undefined;
}
