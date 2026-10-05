import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, KnowledgeDocument, Project, Task } from "@ai-pixel-office/domain/entities";
import {
  groupRecordsByProject,
  recordsOfProject,
  searchRecords,
} from "../apps/web/src/features/records/utils/recordGroups.ts";
import { projectsBySkill } from "../apps/web/src/features/skills/utils/skillLibraryView.ts";

const record = (id: string, updatedAt: string, links: Partial<KnowledgeDocument> = {}) =>
  ({ id, title: id, content: "", updatedAt, referenceTaskIds: [], ...links }) as KnowledgeDocument;
const task = (id: string, projectId?: string, assigneeAgentId?: string) =>
  ({ id, projectId, assigneeAgentId }) as Task;
const project = (id: string, name: string) => ({ id, name }) as Project;

test("records are grouped by project, then requests without a project, then written ones", () => {
  const groups = groupRecordsByProject(
    [
      record("written", "2026-10-05T01:00:00Z"),
      record("chat", "2026-10-05T02:00:00Z", { taskId: "t-chat" }),
      record("app-old", "2026-10-05T03:00:00Z", { taskId: "t-app" }),
      record("app-new", "2026-10-05T04:00:00Z", { referenceTaskIds: ["t-app"] }),
      record("admin", "2026-10-05T05:00:00Z", { taskId: "t-admin" }),
      record("removed-project", "2026-10-05T06:00:00Z", { taskId: "t-gone" }),
    ],
    [task("t-chat"), task("t-app", "p-app"), task("t-admin", "p-admin"), task("t-gone", "p-gone")],
    [
      project("p-app", "사용자 앱"),
      project("p-admin", "관리자"),
      project("p-empty", "빈 프로젝트"),
    ],
  );
  assert.deepEqual(
    groups.map((group) => [group.title, group.documents.map((document) => document.id)]),
    [
      ["관리자", ["admin"]],
      ["사용자 앱", ["app-new", "app-old"]],
      ["프로젝트 없이 대화", ["removed-project", "chat"]],
      ["직접 쓴 문서", ["written"]],
    ],
  );
});

test("a project's records include documents that only reference its requests", () => {
  const documents = [
    record("made", "2026-10-05T01:00:00Z", { taskId: "t1" }),
    record("referenced", "2026-10-05T02:00:00Z", { referenceTaskIds: ["t1"] }),
    record("other", "2026-10-05T03:00:00Z", { taskId: "t2" }),
  ];
  assert.deepEqual(
    recordsOfProject(documents, [task("t1", "p1"), task("t2", "p2")], "p1").map(
      (document) => document.id,
    ),
    ["made", "referenced"],
  );
  assert.deepEqual(
    searchRecords([{ ...documents[0]!, content: "로그인 결정" }], "로그인").map(
      (document) => document.id,
    ),
    ["made"],
  );
});

test("a skill is used in the projects where its colleagues took requests", () => {
  const agents = [
    { id: "a1", skillIds: ["ux-writing"] },
    { id: "a2", skillIds: ["ux-writing", "testing"] },
  ] as Agent[];
  const usage = projectsBySkill(
    agents,
    [task("t1", "p2", "a1"), task("t2", "p1", "a2"), task("t3", undefined, "a2")],
    [project("p1", "관리자"), project("p2", "사용자 앱")],
  );
  assert.deepEqual(
    usage.get("ux-writing")?.map((item) => item.name),
    ["관리자", "사용자 앱"],
  );
  assert.deepEqual(
    usage.get("testing")?.map((item) => item.name),
    ["관리자"],
  );
});
