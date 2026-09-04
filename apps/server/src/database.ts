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

function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      working_directory TEXT,
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

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      tools_json TEXT NOT NULL,
      required_permissions_json TEXT,
      output_schema_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS skills_workspace_idx ON skills(workspace_id);

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agents_workspace_idx ON agents(workspace_id);

    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
      PRIMARY KEY(agent_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('todo', 'working', 'needs_review', 'needs_input', 'blocked', 'done', 'failed')),
      assignee_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      source_input_id TEXT,
      due_date TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      working_directory TEXT,
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS tasks_workspace_status_idx ON tasks(workspace_id, status);

    CREATE TABLE IF NOT EXISTS inputs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'request' CHECK(type IN ('request', 'feedback', 'idea', 'message', 'file')),
      title TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox', 'triaged', 'converted', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS inputs_workspace_status_idx
      ON inputs(workspace_id, status, created_at DESC);

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

    CREATE TABLE IF NOT EXISTS task_workflow_steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'working', 'completed', 'failed')),
      run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(task_id, position)
    );
    CREATE INDEX IF NOT EXISTS workflow_steps_task_position_idx
      ON task_workflow_steps(task_id, position);

    CREATE TABLE IF NOT EXISTS workflow_presets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      agent_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, name)
    );
    CREATE INDEX IF NOT EXISTS workflow_presets_workspace_idx
      ON workflow_presets(workspace_id, updated_at DESC);

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

  const agentColumns = database.prepare("PRAGMA table_info(agents)").all() as Array<{
    name: string;
  }>;
  if (!agentColumns.some((column) => column.name === "avatar_id")) {
    database.exec("ALTER TABLE agents ADD COLUMN avatar_id TEXT");
  }
  if (!agentColumns.some((column) => column.name === "working_directory")) {
    database.exec("ALTER TABLE agents ADD COLUMN working_directory TEXT");
  }
  if (!agentColumns.some((column) => column.name === "mode")) {
    database.exec("ALTER TABLE agents ADD COLUMN mode TEXT NOT NULL DEFAULT 'worker'");
  }
  if (!agentColumns.some((column) => column.name === "model_policy")) {
    database.exec("ALTER TABLE agents ADD COLUMN model_policy TEXT NOT NULL DEFAULT 'default'");
  }
  if (!agentColumns.some((column) => column.name === "model_name")) {
    database.exec("ALTER TABLE agents ADD COLUMN model_name TEXT");
  }
  if (!agentColumns.some((column) => column.name === "reasoning_effort")) {
    database.exec("ALTER TABLE agents ADD COLUMN reasoning_effort TEXT");
  }
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
  const workspaceColumns = database.prepare("PRAGMA table_info(workspaces)").all() as Array<{
    name: string;
  }>;
  if (!workspaceColumns.some((column) => column.name === "working_directory")) {
    database.exec("ALTER TABLE workspaces ADD COLUMN working_directory TEXT");
  }
  const taskColumns = database.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
  if (!taskColumns.some((column) => column.name === "working_directory")) {
    database.exec("ALTER TABLE tasks ADD COLUMN working_directory TEXT");
  }
  if (!taskColumns.some((column) => column.name === "project_id")) {
    database.exec(
      "ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
    );
  }
  const runColumns = database.prepare("PRAGMA table_info(agent_runs)").all() as Array<{
    name: string;
  }>;
  if (!runColumns.some((column) => column.name === "model_policy")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN model_policy TEXT NOT NULL DEFAULT 'default'");
  }
  if (!runColumns.some((column) => column.name === "model_name")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN model_name TEXT");
  }
  if (!runColumns.some((column) => column.name === "reasoning_effort")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN reasoning_effort TEXT");
  }
  if (!runColumns.some((column) => column.name === "request_text")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN request_text TEXT");
  }
  if (!runColumns.some((column) => column.name === "result_json")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN result_json TEXT");
  }
  if (!runColumns.some((column) => column.name === "working_directory")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN working_directory TEXT");
  }
  if (!runColumns.some((column) => column.name === "scope_type")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'general'");
  }
  if (!runColumns.some((column) => column.name === "scope_project_id")) {
    database.exec("ALTER TABLE agent_runs ADD COLUMN scope_project_id TEXT");
  }
  database.exec(`INSERT OR IGNORE INTO projects
    (id, workspace_id, name, status, working_directory, created_at, updated_at)
    SELECT id, workspace_id, name, 'active', path, created_at, created_at FROM project_directories`);
  database.exec("DROP TABLE project_directories");
}

export function requireEntity<T>(value: T | undefined, entity: string, id: string): T {
  if (value === undefined) {
    throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
  }
  return value;
}
