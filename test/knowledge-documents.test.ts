import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { KnowledgeDocumentStore } from "../apps/server/src/knowledge-documents.ts";

test("기록실 문서는 Markdown 파일을 원본으로 생성하고 다시 읽는다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pixel-office-records-"));
  try {
    const store = new KnowledgeDocumentStore(directory);
    const created = await store.create({
      workspaceId: "workspace-1",
      title: "결제 정책 결정",
      content: "# 결정\n\n카드 결제를 우선 지원한다.",
      taskId: "task-1",
      runId: "run-1",
      referenceTaskIds: ["task-2"],
    });

    const source = await readFile(
      join(directory, "records", "workspace-1", created.fileName),
      "utf8",
    );
    assert.match(source, /taskId: "task-1"/);
    assert.match(source, /카드 결제를 우선 지원한다/);
    assert.deepEqual((await store.list("workspace-1"))[0]?.referenceTaskIds, ["task-2"]);
    assert.deepEqual((await store.list("workspace-1"))[0], created);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("가져온 Markdown은 새 로컬 문서로 저장하며 연결 정보를 보존한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pixel-office-records-import-"));
  try {
    const store = new KnowledgeDocumentStore(directory);
    const imported = await store.import(
      "workspace-1",
      "meeting.md",
      '---\ntitle: "회의 결과"\ntaskId: "task-2"\n---\n\n## 합의\n\n다음 주 배포',
    );

    assert.equal(imported.title, "회의 결과");
    assert.equal(imported.taskId, "task-2");
    assert.match(imported.content, /다음 주 배포/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
