import type { AddressInfo } from "node:net";
import { startServer } from "../apps/server/src/index.ts";

const { server } = await startServer({ port: 0, host: "127.0.0.1", databasePath: ":memory:" });
const port = (server.server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as { data?: T; error?: { message: string } };
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  }
  return body.data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

try {
  const workspace = await post<{ id: string }>("/api/workspaces", { name: "MVP Smoke Workspace" });
  const skill = await post<{ id: string }>("/api/skills", {
    workspaceId: workspace.id,
    name: "Concise Response",
    category: "Validation",
    description: "Return a deterministic validation result",
    instructions: "Do not use tools. Reply with exactly the text requested by the task.",
    tools: [],
    requiredPermissions: [],
  });
  const agent = await post<{ id: string }>("/api/agents", {
    workspaceId: workspace.id,
    name: "MVP Validator",
    role: "Validate the server execution loop",
    model: "codex",
    skillIds: [skill.id],
    permissions: { fileRead: true, terminal: true },
  });
  const task = await post<{ id: string; status: string }>("/api/tasks", {
    workspaceId: workspace.id,
    title: "Reply with exactly: mvp-server-loop-ok",
    description: "Do not use tools or add any other text.",
    assigneeAgentId: agent.id,
  });
  const run = await post<{ id: string }>(`/api/tasks/${task.id}/run`, {});

  const deadline = Date.now() + 120_000;
  let runState: { status: string; error?: string };
  do {
    if (Date.now() > deadline) throw new Error("Timed out waiting for AgentRun");
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    runState = await api(`/api/runs/${run.id}`);
  } while (["queued", "running", "waiting"].includes(runState.status));

  if (runState.status !== "completed") {
    throw new Error(`AgentRun ended as ${runState.status}: ${runState.error ?? "unknown error"}`);
  }
  const reviewTask = await api<{ status: string; result?: { summary: string } }>(
    `/api/tasks/${task.id}`,
  );
  if (
    reviewTask.status !== "needs_review" ||
    !reviewTask.result?.summary.includes("mvp-server-loop-ok")
  ) {
    throw new Error(`Unexpected review result: ${JSON.stringify(reviewTask)}`);
  }
  const approved = await post<{ status: string }>(`/api/tasks/${task.id}/approve`, {});
  if (approved.status !== "done") throw new Error(`Task approval ended as ${approved.status}`);

  console.log(
    JSON.stringify(
      {
        workspaceCreated: true,
        agentAndSkillCreated: true,
        taskStates: [task.status, "working", reviewTask.status, approved.status],
        result: reviewTask.result.summary,
        runStatus: runState.status,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
