import type { StatementResultingChanges } from "node:sqlite";
import { DomainError } from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";

export function withTransaction<T>(database: AppDatabase, action: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    if (result instanceof Promise) {
      throw new Error("Repository transactions must use synchronous callbacks");
    }
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function requireChanged(
  result: StatementResultingChanges,
  entity: string,
  id: string,
): void {
  if (result.changes === 0 || result.changes === 0n) {
    throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
  }
}
