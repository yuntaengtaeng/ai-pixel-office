import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { DatabaseSync as NodeDatabaseSync } from "node:sqlite";
import { DomainError } from "@ai-pixel-office/domain";

const loadNodeBuiltin = createRequire(process.execPath);
// esbuild strips the `node:` prefix from static imports. `sqlite` is only
// available with that prefix, so keep this runtime lookup opaque to bundlers.
const { DatabaseSync } = loadNodeBuiltin("node:sqlite") as typeof import("node:sqlite");

export type AppDatabase = NodeDatabaseSync;

export function openDatabase(path = "data/ai-pixel-office.sqlite"): AppDatabase {
  const resolved = path === ":memory:" ? path : resolve(path);
  if (resolved !== ":memory:") mkdirSync(dirname(resolved), { recursive: true });
  const database = new DatabaseSync(resolved);
  database.exec("PRAGMA foreign_keys = ON");
  if (resolved !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  migrate(database);
  return database;
}

/** 앱 데이터 구조 버전 (더 낮은 버전으로 만든 DB는 열 때 모든 테이블을 지우고 새로 생성) */
export const DATA_SCHEMA_VERSION = 2;
export const LEGACY_DATA_RESET_KEY = "legacy_data_reset_at";

function dropTablesOfOlderDataVersion(database: AppDatabase): boolean {
  const { user_version: version } = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version >= DATA_SCHEMA_VERSION) return false;
  const tables = (
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
  ).map((table) => table.name);
  if (tables.length === 0) return false;
  database.exec("PRAGMA foreign_keys = OFF");
  for (const table of tables) database.exec(`DROP TABLE IF EXISTS "${table}"`);
  database.exec("PRAGMA foreign_keys = ON");
  return tables.includes("workspaces");
}

function migrate(database: AppDatabase): void {
  const droppedOlderData = dropTablesOfOlderDataVersion(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      working_directory TEXT,
      default_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_directories (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(workspace_id, path)
    );
    CREATE INDEX IF NOT EXISTS project_directories_workspace_idx
      ON project_directories(workspace_id, created_at);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'done')),
      figma_url TEXT,
      working_directory TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS projects_workspace_status_idx
      ON projects(workspace_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT,
      model TEXT NOT NULL CHECK(model IN ('claude', 'codex')),
      model_policy TEXT NOT NULL DEFAULT 'default' CHECK(model_policy IN ('default', 'auto', 'manual')),
      model_name TEXT,
      reasoning_effort TEXT CHECK(reasoning_effort IN ('low', 'medium', 'high', 'xhigh')),
      mode TEXT NOT NULL DEFAULT 'worker' CHECK(mode IN ('worker', 'chat')),
      avatar_id TEXT,
      permissions_json TEXT NOT NULL,
      system_prompt TEXT,
      working_directory TEXT,
      source_team TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agents_workspace_idx ON agents(workspace_id);

    CREATE TABLE IF NOT EXISTS pet_unlocks (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      pet_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id, pet_id)
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      -- skill_id: 스킬 라이브러리 폴더 이름
      skill_id TEXT NOT NULL,
      PRIMARY KEY(agent_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('todo', 'working', 'needs_review', 'needs_input', 'blocked', 'done', 'failed')),
      assignee_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      due_date TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      working_directory TEXT,
      result_json TEXT,
      origin TEXT NOT NULL DEFAULT 'office' CHECK(origin IN ('office', 'chat')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS tasks_workspace_status_idx ON tasks(workspace_id, status);
    CREATE INDEX IF NOT EXISTS tasks_workspace_completion_idx
      ON tasks(workspace_id, status, completed_at);

    CREATE TABLE IF NOT EXISTS agent_task_templates (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_task_templates_agent_idx
      ON agent_task_templates(agent_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      runtime TEXT NOT NULL CHECK(runtime IN ('claude', 'codex')),
      model_policy TEXT NOT NULL DEFAULT 'default' CHECK(model_policy IN ('default', 'auto', 'manual')),
      model_name TEXT,
      reasoning_effort TEXT CHECK(reasoning_effort IN ('low', 'medium', 'high', 'xhigh')),
      status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
      resumed_from_run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
      runtime_thread_id TEXT,
      started_at TEXT,
      finished_at TEXT,
      event_log_ref TEXT,
      usage_json TEXT,
      request_text TEXT,
      result_json TEXT,
      scope_type TEXT NOT NULL DEFAULT 'general' CHECK(scope_type IN ('general', 'project')),
      scope_project_id TEXT,
      working_directory TEXT,
      error TEXT,
      cleanup_policy TEXT NOT NULL DEFAULT 'preserve' CHECK(cleanup_policy IN ('preserve', 'discard')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_task_created_idx ON agent_runs(task_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS task_attachments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size >= 0),
      source TEXT NOT NULL CHECK(source IN ('file', 'clipboard-image')),
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS task_attachments_task_created_idx
      ON task_attachments(task_id, created_at DESC);

    -- skill_id는 FK 미설정, Skill이 삭제되어도 skill_name_snapshot으로 과거 표시를 유지
    CREATE TABLE IF NOT EXISTS run_skills (
      run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL,
      skill_name_snapshot TEXT NOT NULL,
      skill_version TEXT,
      position INTEGER NOT NULL,
      PRIMARY KEY(run_id, skill_id)
    );
    CREATE INDEX IF NOT EXISTS run_skills_skill_idx ON run_skills(skill_id);

    CREATE TABLE IF NOT EXISTS run_progress_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS run_progress_run_created_idx
      ON run_progress_events(run_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS task_reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
      action TEXT NOT NULL CHECK(action IN ('approved', 'changes_requested')),
      feedback TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_workspace_created_idx ON activity_logs(workspace_id, created_at DESC);
  `);

  addMissingColumns(database, "agents", {
    avatar_id: "TEXT",
    working_directory: "TEXT",
    mode: "TEXT NOT NULL DEFAULT 'worker'",
    model_policy: "TEXT NOT NULL DEFAULT 'default'",
    model_name: "TEXT",
    reasoning_effort: "TEXT",
  });
  database.exec(`
    UPDATE agents
    SET mode = 'worker',
        permissions_json = json_set(
          permissions_json,
          '$.fileRead', json('true'),
          '$.fileWrite', json('true'),
          '$.terminal', json('true')
        )
    WHERE mode = 'chat'
  `);
  addMissingColumns(database, "workspaces", {
    default_agent_id: "TEXT REFERENCES agents(id) ON DELETE SET NULL",
    working_directory: "TEXT",
  });
  addMissingColumns(database, "tasks", {
    working_directory: "TEXT",
    project_id: "TEXT REFERENCES projects(id) ON DELETE SET NULL",
    origin: "TEXT NOT NULL DEFAULT 'office'",
    queued_behind: "TEXT",
    result_format: "TEXT",
    modifies_files: "INTEGER",
    plan_id: "TEXT REFERENCES lead_plans(id) ON DELETE SET NULL",
    waits_for_json: "TEXT",
    review_before_next: "INTEGER NOT NULL DEFAULT 0",
  });
  database.exec(
    "CREATE INDEX IF NOT EXISTS tasks_workspace_origin_idx ON tasks(workspace_id, origin, created_at DESC)",
  );
  addMissingColumns(database, "agent_runs", {
    model_policy: "TEXT NOT NULL DEFAULT 'default'",
    model_name: "TEXT",
    reasoning_effort: "TEXT",
    request_text: "TEXT",
    result_json: "TEXT",
    working_directory: "TEXT",
    scope_type: "TEXT NOT NULL DEFAULT 'general'",
    scope_project_id: "TEXT",
    resumed_from_run_id: "TEXT REFERENCES agent_runs(id)",
  });
  database.exec("CREATE INDEX IF NOT EXISTS runs_resumed_from_idx ON agent_runs(resumed_from_run_id)");
  addMissingColumns(database, "projects", {
    memo: "TEXT",
    verification_commands_json: "TEXT NOT NULL DEFAULT '[]'",
    setup_command: "TEXT",
    copy_files_json: "TEXT NOT NULL DEFAULT '[]'",
    default_agent_id: "TEXT REFERENCES agents(id) ON DELETE SET NULL",
    preview_url: "TEXT",
    lead_runtime: "TEXT",
  });
  addMissingColumns(database, "agent_runs", { modifies_files: "INTEGER NOT NULL DEFAULT 0" });
  database.exec(`CREATE TABLE IF NOT EXISTS request_workspaces (
    task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    repository_root TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS lead_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('proposed', 'approved', 'rejected')),
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    items_json TEXT NOT NULL,
    feedback TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS lead_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'lead', 'report')),
    content TEXT NOT NULL,
    plan_id TEXT REFERENCES lead_plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'done', 'failed')),
    runtime TEXT,
    thread_id TEXT,
    created_at TEXT NOT NULL
  )`);
  database.exec("CREATE INDEX IF NOT EXISTS lead_messages_project_idx ON lead_messages(project_id, created_at)");
  database.exec("DROP TABLE IF EXISTS task_workflow_steps");
  database.exec("DROP TABLE IF EXISTS workflow_presets");
  dropColumns(database, "projects", ["default_assignee_json"]);
  database.exec(`INSERT OR IGNORE INTO projects
    (id, workspace_id, name, status, working_directory, created_at, updated_at)
    SELECT id, workspace_id, name, 'active', path, created_at, created_at FROM project_directories`);
  database.exec("DROP TABLE project_directories");
  database.exec(`PRAGMA user_version = ${DATA_SCHEMA_VERSION}`);
  if (droppedOlderData) {
    database
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
      .run(LEGACY_DATA_RESET_KEY, new Date().toISOString());
  }
}

/** 테이블에 없는 열만 추가 (기존 데이터 유지) */
function addMissingColumns(
  database: AppDatabase,
  table: string,
  columns: Record<string, string>,
): void {
  const existing = new Set(
    (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

/** 테이블에 남아 있는 열만 지움 */
function dropColumns(database: AppDatabase, table: string, columns: string[]): void {
  const existing = new Set(
    (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  for (const name of columns) {
    if (existing.has(name)) database.exec(`ALTER TABLE ${table} DROP COLUMN ${name}`);
  }
}

export function requireEntity<T>(value: T | undefined, entity: string, id: string): T {
  if (value === undefined) {
    throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
  }
  return value;
}
