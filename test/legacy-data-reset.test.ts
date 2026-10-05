import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LEGACY_DATA_RESET_KEY, openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository/index.ts";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

function databasePath(context: test.TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "ai-pixel-db-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "app.sqlite");
}

test("resets data created by an older data version and records when", async (context) => {
  const path = databasePath(context);
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE skills (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    INSERT INTO workspaces VALUES ('old', 'Old workspace', '2026-09-01', '2026-09-01');
    INSERT INTO skills VALUES ('s1', 'Old skill');
  `);
  legacy.close();

  const repository = new Repository(openDatabase(path));
  try {
    assert.deepEqual(await repository.listWorkspaces(), []);
    assert.ok(repository.getAppMeta(LEGACY_DATA_RESET_KEY));
  } finally {
    repository.close();
  }
});

test("does not report a reset for a brand new database", (context) => {
  const repository = new Repository(openDatabase(databasePath(context)));
  try {
    assert.equal(repository.getAppMeta(LEGACY_DATA_RESET_KEY), undefined);
  } finally {
    repository.close();
  }
});

test("keeps data created by the current data version", async (context) => {
  const path = databasePath(context);
  const first = new Repository(openDatabase(path));
  await first.createWorkspace({ name: "Studio" });
  first.close();

  const reopened = new Repository(openDatabase(path));
  try {
    assert.deepEqual(
      (await reopened.listWorkspaces()).map((workspace) => workspace.name),
      ["Studio"],
    );
    assert.equal(reopened.getAppMeta(LEGACY_DATA_RESET_KEY), undefined);
  } finally {
    reopened.close();
  }
});
