import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, Project, AgentRun, Task } from "@ai-pixel-office/domain/entities";
import { latestVerifications } from "../apps/web/src/features/tasks/utils/requestReview.ts";
import {
  candidateValues,
  toggleValue,
} from "../apps/web/src/features/projects/utils/projectSettings.ts";
import {
  activeRequestsForSidebar,
  groupRequestsByColumn,
} from "../apps/web/src/features/tasks/utils/requestBoard.ts";
import {
  currentProjectIdOf,
  sidebarProjects,
} from "../apps/web/src/features/projects/utils/sidebarProjects.ts";
import {
  assignableAgents,
  pickAssignee,
} from "../apps/web/src/features/tasks/utils/requestAssignee.ts";
import { requestTitle } from "../apps/web/src/features/tasks/utils/requestTitle.ts";

const task = (id: string, status: Task["status"], updatedAt: string) =>
  ({ id, status, updatedAt, title: id }) as Task;
const agent = (id: string, name: string) => ({ id, name }) as Agent;

test("the board puts each request in the column for what it is waiting on", () => {
  const columns = groupRequestsByColumn([
    task("a", "working", "2026-10-05T01:00:00Z"),
    task("b", "needs_input", "2026-10-05T02:00:00Z"),
    task("c", "failed", "2026-10-05T03:00:00Z"),
    task("d", "needs_review", "2026-10-05T04:00:00Z"),
    task("e", "done", "2026-10-05T05:00:00Z"),
    { ...task("f", "todo", "2026-10-05T06:00:00Z"), queuedBehind: "a" },
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(columns).map(([id, items]) => [id, items.map((item) => item.id)]),
    ),
    { queued: ["f"], working: ["a"], needs_me: ["c", "b"], review: ["d"], done: ["e"] },
  );
});

test("the sidebar shows unfinished requests, the ones needing a decision first", () => {
  const shown = activeRequestsForSidebar(
    [
      task("working", "working", "2026-10-05T09:00:00Z"),
      task("review", "needs_review", "2026-10-05T01:00:00Z"),
      task("question", "needs_input", "2026-10-05T02:00:00Z"),
      task("done", "done", "2026-10-05T10:00:00Z"),
    ],
    2,
  );
  assert.deepEqual(
    shown.map((item) => item.id),
    ["question", "review"],
  );
});

test("a request title is the first line of the message, shortened when long", () => {
  assert.equal(requestTitle("로그인 화면 개선\n자세한 내용"), "로그인 화면 개선");
  assert.equal(requestTitle("가".repeat(80)).length, 60);
});

test("shows the check results of the latest run that ran project checks", () => {
  const run = (verifications?: unknown) =>
    ({ result: { summary: "", metadata: verifications ? { verifications } : {} } }) as AgentRun;
  assert.deepEqual(
    latestVerifications([
      run(),
      run([{ command: "pnpm test", passed: false }]),
      run([{ command: "old", passed: true }]),
    ]),
    [{ command: "pnpm test", passed: false }],
  );
  assert.deepEqual(latestVerifications([run()]), []);
});

test("project setting candidates keep saved values first and add new suggestions once", () => {
  assert.deepEqual(candidateValues(["pnpm test"], ["pnpm typecheck", "pnpm test", " "]), [
    "pnpm test",
    "pnpm typecheck",
  ]);
  assert.deepEqual(toggleValue(["a", "b"], "a", false), ["b"]);
  assert.deepEqual(toggleValue(["b"], "a", true), ["b", "a"]);
});

test("the sidebar knows the current project from a project page or one of its requests", () => {
  const tasks = [{ ...task("t1", "working", "2026-10-05T01:00:00Z"), projectId: "p1" }];
  assert.equal(currentProjectIdOf("/projects/p2", tasks), "p2");
  assert.equal(currentProjectIdOf("/tasks/t1", tasks), "p1");
  assert.equal(currentProjectIdOf("/chat", tasks), undefined);
});

test("the sidebar lists unfinished projects by name and expands only the current one", () => {
  const project = (id: string, name: string, status: Project["status"]) =>
    ({ id, name, status }) as Project;
  const entries = sidebarProjects(
    [project("p1", "나", "active"), project("p2", "가", "paused"), project("p3", "다", "done")],
    [
      { ...task("t1", "needs_input", "2026-10-05T01:00:00Z"), projectId: "p1" },
      { ...task("t2", "done", "2026-10-05T02:00:00Z"), projectId: "p1" },
      { ...task("t3", "working", "2026-10-05T03:00:00Z"), projectId: "p2" },
    ],
    "p1",
    5,
  );
  assert.deepEqual(
    entries.map((entry) => [entry.project.id, entry.requests.map((item) => item.id)]),
    [
      ["p2", []],
      ["p1", ["t1"]],
    ],
  );
});

test("a new request starts with the project's default assignee until the user picks someone", () => {
  const agents = assignableAgents([agent("u", "라떼"), agent("d", "단풍")]);
  assert.deepEqual(
    agents.map((item) => item.name),
    ["단풍", "라떼"],
  );

  assert.equal(pickAssignee(agents, undefined, "u")?.name, "라떼");
  assert.equal(pickAssignee(agents, "d", "u")?.name, "단풍");
  assert.equal(pickAssignee(agents, undefined, "gone")?.name, "단풍");
});

test("questions a colleague left are shown only while the request waits for an answer", async () => {
  const { openQuestionsOf, resultSections, summaryWithoutReportedJson } =
    await import("../apps/web/src/features/tasks/utils/requestResult.ts");
  const run = {
    status: "completed",
    result: {
      summary: "{}",
      metadata: {
        reportedResult: {
          type: "ux_handoff",
          problem: "문제 화면이 흩어져 있어요",
          primary_flow: ["Audit 탭을 연다", "항목을 누른다"],
          component_hierarchy: { Audit: { props: ["project"], children: "AuditGroup" } },
          user_questions: ["다른 기준이 있나요?", { question: "끊어진 연결도 다룰까요?" }],
        },
      },
    },
  } as unknown as AgentRun;

  assert.deepEqual(openQuestionsOf({ status: "needs_input" }, [run]), [
    "다른 기준이 있나요?",
    "끊어진 연결도 다룰까요?",
  ]);
  assert.deepEqual(openQuestionsOf({ status: "needs_review" }, [run]), []);
  assert.deepEqual(
    resultSections(run.result!.metadata!.reportedResult as Record<string, unknown>).map(
      (section) => [section.label, section.paragraphs.length, section.items.length],
    ),
    [
      ["문제", 1, 0],
      ["주요 흐름", 0, 2],
      ["컴포넌트 구성", 0, 1],
    ],
  );
  assert.deepEqual(
    resultSections({
      component_hierarchy: { Audit: { props: ["project"], children: "AuditGroup" } },
    })[0]?.items,
    ["Audit: props: project; children: AuditGroup"],
  );
  assert.equal(summaryWithoutReportedJson('{ "type": "ux" }'), "");
  assert.equal(summaryWithoutReportedJson("흐름을 정리했어요."), "흐름을 정리했어요.");
});

test("an approved plan tells what to do next for each request", async () => {
  const { planProgress } = await import("../apps/web/src/features/lead/utils/leadView.ts");
  const plan = {
    id: "p",
    items: [
      { key: "flow", title: "흐름" },
      { key: "spec", title: "명세" },
    ],
  } as never;
  const progress = planProgress(plan, [
    { id: "t1", planId: "p", title: "흐름", status: "needs_input" },
    { id: "t2", planId: "p", title: "명세", status: "todo", queuedBehind: "흐름" },
  ] as Task[]);
  assert.deepEqual(
    progress.map((entry) => [entry.state, entry.nextAction]),
    [
      ["질문이 있어요", "질문에 답하기"],
      ["순서 대기", undefined],
    ],
  );
});

test("a diff is split into added, removed, hunk and header lines", async () => {
  const { diffLines, diffStats } = await import("../apps/web/src/shared/lib/diffLines.ts");
  const lines = diffLines(
    "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n",
  );
  assert.deepEqual(
    lines.map((line) => line.kind),
    ["meta", "meta", "meta", "hunk", "context", "removed", "added"],
  );
  assert.deepEqual(diffStats(lines), { added: 1, removed: 1 });
});
