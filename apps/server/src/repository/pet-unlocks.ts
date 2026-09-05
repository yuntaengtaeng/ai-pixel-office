import { DomainError } from "@ai-pixel-office/domain";
import { UNLOCKABLE_PETS } from "@ai-pixel-office/pet";
import type { AppDatabase } from "../database.ts";

export type PetUnlockProgress = {
  petId: string;
  unlocked: boolean;
  progress: number;
  target: number;
  mission: string;
  hint: string;
};

function calculate(database: AppDatabase, workspaceId: string): PetUnlockProgress[] {
  if (!database.prepare("SELECT 1 FROM workspaces WHERE id = ?").get(workspaceId))
    throw new DomainError("NOT_FOUND", `Workspace not found: ${workspaceId}`, 404);
  const dailyCompletions = database
    .prepare(
      `SELECT
         COALESCE(MAX(completed_count), 0) AS max_count,
         COALESCE(MAX(CASE WHEN completed_day = date('now', 'localtime') THEN completed_count ELSE 0 END), 0) AS today_count
       FROM (
         SELECT date(completed_at, 'localtime') AS completed_day, COUNT(*) AS completed_count
         FROM tasks
         WHERE workspace_id = ? AND status = 'done' AND completed_at IS NOT NULL
         GROUP BY date(completed_at, 'localtime')
       )`,
    )
    .get(workspaceId) as { max_count: number; today_count: number };
  const achieved = new Set(
    (
      database
        .prepare("SELECT pet_id FROM pet_unlocks WHERE workspace_id = ?")
        .all(workspaceId) as Array<{ pet_id: string }>
    ).map((row) => row.pet_id),
  );
  if (dailyCompletions.max_count >= 10) achieved.add("rabbit-yuzu");
  if (
    database
      .prepare(
        "SELECT 1 FROM projects WHERE workspace_id = ? AND working_directory IS NOT NULL LIMIT 1",
      )
      .get(workspaceId)
  )
    achieved.add("capybara-gamja");
  if (
    database
      .prepare(
        `SELECT 1 FROM tasks t JOIN task_workflow_steps s ON s.task_id = t.id WHERE t.workspace_id = ? AND t.status = 'done' GROUP BY t.id HAVING COUNT(DISTINCT s.agent_id) >= 2 LIMIT 1`,
      )
      .get(workspaceId)
  )
    achieved.add("quokka-bangul");
  return UNLOCKABLE_PETS.map((pet) => ({
    petId: pet.id,
    unlocked: achieved.has(pet.id),
    progress:
      pet.id === "rabbit-yuzu"
        ? achieved.has(pet.id)
          ? 10
          : Math.min(dailyCompletions.today_count, 10)
        : achieved.has(pet.id)
          ? 1
          : 0,
    target: pet.id === "rabbit-yuzu" ? 10 : 1,
    mission: pet.unlock!.mission,
    hint: pet.unlock!.hint,
  }));
}

export function readPetUnlockProgress(
  database: AppDatabase,
  workspaceId: string,
): PetUnlockProgress[] {
  return calculate(database, workspaceId);
}

export function evaluatePetUnlocks(
  database: AppDatabase,
  workspaceId: string,
): PetUnlockProgress[] {
  const progress = calculate(database, workspaceId);
  const insert = database.prepare(
    "INSERT OR IGNORE INTO pet_unlocks (workspace_id, pet_id, unlocked_at) VALUES (?, ?, ?)",
  );
  for (const item of progress)
    if (item.unlocked) insert.run(workspaceId, item.petId, new Date().toISOString());
  return progress;
}
