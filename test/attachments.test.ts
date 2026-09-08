import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../apps/server/src/database.ts";
import { EventBus } from "../apps/server/src/events.ts";
import { createHttpServer } from "../apps/server/src/http.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import type { RuntimeAdapter } from "../apps/server/src/runtime/index.ts";

const inactiveRuntime: RuntimeAdapter = {
  async run() { throw new Error("not used"); },
  cancel() { return false; },
  resolveApproval() { return false; },
};

test("stores attachments under the task and removes the file with the task", async () => {
  const root = await mkdtemp(join(tmpdir(), "pixel-office-attachments-"));
  const repository = new Repository(openDatabase(":memory:"));
  const workspace = await repository.createWorkspace({ name: "Attachment test" });
  const task = await repository.createTask({ workspaceId: workspace.id, title: "Inspect file" });
  const events = new EventBus();
  const orchestrator = new Orchestrator(repository, inactiveRuntime, events, {
    generalWorkingDirectory: root,
  });
  const server = createHttpServer({ repository, orchestrator, events, generalWorkingDirectory: root });

  try {
    const upload = await server.inject({
      method: "POST",
      url: "/api/attachments",
      headers: { "content-type": "application/json" },
      payload: {
        workspaceId: workspace.id,
        taskId: task.id,
        name: "note.txt",
        mediaType: "text/plain",
        source: "file",
        data: Buffer.from("hello").toString("base64"),
      },
    });
    assert.equal(upload.statusCode, 201);
    const attachmentId = (upload.json() as { data: { id: string } }).data.id;
    const stored = repository.getAttachment(attachmentId);
    assert.ok(stored);
    await access(stored.storagePath);

    const removed = await server.inject({ method: "DELETE", url: `/api/tasks/${task.id}` });
    assert.equal(removed.statusCode, 204);
    await assert.rejects(access(stored.storagePath));
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an attachment when workspace and task ownership do not match", async () => {
  const root = await mkdtemp(join(tmpdir(), "pixel-office-attachment-scope-"));
  const repository = new Repository(openDatabase(":memory:"));
  const workspace = await repository.createWorkspace({ name: "Owner" });
  const otherWorkspace = await repository.createWorkspace({ name: "Other" });
  const task = await repository.createTask({ workspaceId: workspace.id, title: "Owned task" });
  const events = new EventBus();
  const orchestrator = new Orchestrator(repository, inactiveRuntime, events, {
    generalWorkingDirectory: root,
  });
  const server = createHttpServer({ repository, orchestrator, events, generalWorkingDirectory: root });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/api/attachments",
      headers: { "content-type": "application/json" },
      payload: {
        workspaceId: otherWorkspace.id,
        taskId: task.id,
        name: "wrong.txt",
        mediaType: "text/plain",
        source: "file",
        data: Buffer.from("no").toString("base64"),
      },
    });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(repository.listAttachmentsByTask(task.id), []);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("reports storage and clears app-owned data without touching a linked project", async () => {
  const root = await mkdtemp(join(tmpdir(), "pixel-office-storage-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "pixel-office-project-"));
  const repository = new Repository(openDatabase(":memory:"));
  const workspace = await repository.createWorkspace({ name: "Storage test" });
  await repository.createProjectDirectory({ workspaceId: workspace.id, name: "Project", path: projectRoot });
  const task = await repository.createTask({ workspaceId: workspace.id, title: "Keep project" });
  const events = new EventBus();
  const orchestrator = new Orchestrator(repository, inactiveRuntime, events, { generalWorkingDirectory: root });
  const server = createHttpServer({ repository, orchestrator, events, generalWorkingDirectory: root });
  try {
    await server.inject({
      method: "POST", url: "/api/attachments", headers: { "content-type": "application/json" },
      payload: { workspaceId: workspace.id, taskId: task.id, name: "temp.txt", mediaType: "text/plain", source: "file", data: Buffer.from("hello").toString("base64") },
    });
    const summary = await server.inject({ method: "GET", url: `/api/storage?workspaceId=${workspace.id}` });
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.json() as { data: { attachmentBytes: number } }).data.attachmentBytes, 5);

    const reset = await server.inject({ method: "POST", url: "/api/storage/reset", payload: { confirmation: "AI Pixel Office 데이터 초기화" } });
    assert.equal(reset.statusCode, 200);
    assert.deepEqual(await repository.listWorkspaces(), []);
    await access(projectRoot);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  }
});
