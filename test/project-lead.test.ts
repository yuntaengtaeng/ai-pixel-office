import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Agent, Task } from "@ai-pixel-office/domain";
import type { AgentEvent } from "@ai-pixel-office/runtime-protocol";
import { EventBus } from "../apps/server/src/events.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import { leadReplyText, readLeadPlan } from "../apps/server/src/lead/lead-plan.ts";
import { leadTurnPrompt } from "../apps/server/src/lead/lead-prompt.ts";
import { readyPlanTasks } from "../apps/server/src/request-engine/plan-order.ts";
import { requiredFields } from "../apps/server/src/request-engine/output-contract.ts";
import { RequestWorkspaceService } from "../apps/server/src/request-workspace-service.ts";
import type { RuntimeAdapter, RuntimeRunInput } from "../apps/server/src/runtime/index.ts";

const agent = (id: string, name: string) => ({ id, name }) as Agent;
const colleagues = [agent("latte", "라떼"), agent("danpung", "단풍")];

const planItem = (overrides: Record<string, unknown>) => ({
  key: "flow",
  title: "흐름 정리",
  deliverable: "감사 탭 흐름 문서",
  brief: "감사 탭 흐름을 정리해 주세요",
  assignee: "latte",
  ...overrides,
});

test("reads a lead's plan, matching colleagues by id or name", () => {
  const reading = readLeadPlan(
    {
      plan: {
        title: "감사 탭 추가",
        reason: "흐름을 먼저 정해요",
        items: [
          planItem({ resultFormat: "ux", reviewBeforeNext: true }),
          planItem({
            key: "build",
            title: "구현",
            assignee: "단풍",
            modifiesFiles: true,
            after: ["flow"],
          }),
        ],
      },
    },
    colleagues,
  );

  assert.equal(reading.kind, "plan");
  if (reading.kind !== "plan") return;
  assert.deepEqual(
    reading.plan.items.map((item) => [
      item.key,
      item.agentId,
      item.modifiesFiles,
      item.after,
      item.reviewBeforeNext,
    ]),
    [
      ["flow", "latte", false, [], true],
      ["build", "danpung", true, ["flow"], false],
    ],
  );
});

test("refuses a plan with an unknown colleague or a later request as an earlier one", () => {
  const reading = readLeadPlan(
    {
      plan: {
        items: [
          planItem({ after: ["build"] }),
          planItem({ key: "build", assignee: "모르는 사람" }),
        ],
      },
    },
    colleagues,
  );

  assert.equal(reading.kind, "invalid");
  if (reading.kind !== "invalid") return;
  assert.ok(reading.problems.some((problem) => problem.includes('"build"는 이 기안보다 먼저')));
  assert.ok(reading.problems.some((problem) => problem.includes("모르는 사람")));
  assert.deepEqual(readLeadPlan({ summary: "그냥 답" }, colleagues), { kind: "none" });
});

test("shows the lead's answer without the plan block and continues sessions with only the update", () => {
  assert.equal(
    leadReplyText('세 개로 나눌게요.\n\n```pixel-office-result\n{"plan":{}}\n```'),
    "세 개로 나눌게요.",
  );
  const context = {
    project: { name: "sketchy", path: "/p", verificationCommands: [] },
    agents: [],
    openTasks: [],
    workGuides: [],
  };
  assert.match(
    leadTurnPrompt({ context, message: "안녕", continuing: false }),
    /You are the project lead/,
  );
  assert.doesNotMatch(
    leadTurnPrompt({ context, message: "안녕", continuing: true }),
    /You are the project lead/,
  );
});

test("a planned request becomes ready only after all its earlier requests are done", () => {
  const task = (id: string, status: Task["status"], waitsFor: string[] = []) =>
    ({ id, status, waitsFor }) as Task;
  assert.deepEqual(
    readyPlanTasks([task("a", "needs_review"), task("b", "todo", ["a"]), task("c", "todo")]).map(
      (item) => item.id,
    ),
    ["c"],
  );
  assert.deepEqual(
    readyPlanTasks([task("a", "done"), task("b", "todo", ["a"])]).map((item) => item.id),
    ["b"],
  );
});

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for state change");
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

test("W1 with a lead: the plan is approved once, the spec is checked, then the build starts with it", async () => {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-lead-"));
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const folder = join(root, "app");
    mkdirSync(folder);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: folder });
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    writeFileSync(join(folder, "screen.txt"), "before\n");
    git("add", "-A");
    git("commit", "-qm", "init");

    const workspace = await repository.createWorkspace({ name: "Studio" });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "sketchy",
      path: folder,
    });
    const createAgent = (name: string, fileWrite: boolean) =>
      repository.createAgent({
        workspaceId: workspace.id,
        name,
        role: name,
        model: "claude",
        skillIds: [],
        permissions: { fileRead: true, fileWrite, terminal: true },
      });
    const latte = await createAgent("라떼", false);
    const danpung = await createAgent("단풍", true);
    const uxResult = Object.fromEntries(
      requiredFields("ux").map((field) => [field, field === "user_questions" ? [] : "흐름"]),
    );
    const seen: RuntimeRunInput[] = [];
    const steps: Array<(input: RuntimeRunInput) => AgentEvent[]> = [
      () => [
        {
          type: "result_reported",
          result: {
            plan: {
              title: "감사 탭 추가",
              reason: "흐름을 먼저 정해요",
              items: [
                planItem({ assignee: latte.id, resultFormat: "ux", reviewBeforeNext: true }),
                planItem({
                  key: "build",
                  title: "감사 탭 구현",
                  deliverable: "감사 탭이 추가된 sketchy",
                  assignee: danpung.id,
                  modifiesFiles: true,
                  after: ["flow"],
                }),
              ],
            },
          },
        },
      ],
      () => [{ type: "result_reported", result: uxResult }],
      (input) => {
        writeFileSync(join(input.cwd, "screen.txt"), "after\n");
        return [];
      },
    ];
    const runtime: RuntimeAdapter = {
      async run(input, callbacks) {
        seen.push(input);
        const step = steps[seen.length - 1];
        if (!step) throw new Error(`No scripted behavior for call ${seen.length}`);
        const summary = seen.length === 1 ? "두 개로 나눌게요." : `call ${seen.length}`;
        const events: AgentEvent[] = [...step(input), { type: "completed", result: { summary } }];
        for (const event of events) callbacks.onEvent(event);
        return { runId: input.runId, threadId: `thread-${seen.length}`, turnId: "turn", events };
      },
      cancel: () => false,
      resolveApproval: () => false,
    };
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory: tmpdir(),
      requestWorkspaces: new RequestWorkspaceService(join(root, "workspaces")),
    });
    const statusOf = async (task: Task) => (await repository.getTask(task.id))?.status;

    await orchestrator.lead.send(project.id, "기획 화면에 감사 탭을 넣고 싶어");
    await waitFor(async () => !(await orchestrator.lead.conversation(project.id)).replying);
    const conversation = await orchestrator.lead.conversation(project.id);
    const [plan] = conversation.plans;
    assert.equal(conversation.messages.at(-1)?.content, "두 개로 나눌게요.");
    assert.equal(seen[0]!.writable, false);
    assert.equal(plan?.status, "proposed");
    assert.equal((await repository.listTasks(workspace.id)).length, 0);

    await orchestrator.lead.approvePlan(plan!.id);
    const [flow, build] = await repository.listPlanTasks(plan!.id);
    assert.equal(build!.queuedBehind, "흐름 정리");
    await waitFor(async () => (await statusOf(flow!)) === "needs_review");
    assert.equal(await statusOf(build!), "todo");

    await orchestrator.approveTask(flow!.id);
    await waitFor(async () => (await statusOf(build!)) === "needs_review");

    assert.match(seen[2]!.prompt, /EARLIER REQUEST RESULT: 흐름 정리/);
    assert.equal((await repository.getTask(build!.id))?.queuedBehind, undefined);
  } finally {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("the lead slime plans while replying and waits while a plan awaits approval", async () => {
  const { leadPoseOf } = await import("../apps/web/src/features/lead/utils/leadView.ts");
  const plan = (status: "proposed" | "approved") => ({ status }) as never;
  assert.equal(leadPoseOf({ replying: true, plans: [plan("proposed")] }), "plan");
  assert.equal(leadPoseOf({ replying: false, plans: [plan("proposed")] }), "wait");
  assert.equal(leadPoseOf({ replying: false, plans: [plan("approved")] }), "idle");
});

test("a plan card shows what the user receives, the order and when they check", async () => {
  const { planOverview } = await import("../apps/web/src/features/lead/utils/leadView.ts");
  const overview = planOverview(
    {
      id: "p",
      projectId: "x",
      status: "proposed",
      title: "감사 탭",
      reason: "",
      createdAt: "",
      items: [
        {
          key: "flow",
          title: "흐름",
          deliverable: "흐름 문서",
          brief: "",
          agentId: "latte",
          modifiesFiles: false,
          after: [],
          reviewBeforeNext: true,
        },
        {
          key: "build",
          title: "구현",
          deliverable: "감사 탭",
          brief: "",
          agentId: "danpung",
          modifiesFiles: true,
          after: ["flow"],
          reviewBeforeNext: false,
        },
      ],
    },
    colleagues,
  );
  assert.equal(overview.order, "라떼 → 단풍");
  assert.equal(overview.fileChangingCount, 1);
  assert.deepEqual(overview.checkpoints, ["흐름 문서 받았을 때", "바뀐 파일 결재"]);
});

test("a plan can be closed without asking the lead again, and a stuck reply can be stopped", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "sketchy",
      path: process.cwd(),
    });
    const runtime: RuntimeAdapter = {
      run: async () => {
        throw new Error("the lead must not run");
      },
      cancel: () => false,
      resolveApproval: () => false,
    };
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory: tmpdir(),
    });
    const plan = repository.createLeadPlan({
      projectId: project.id,
      title: "감사 탭 추가",
      reason: "",
      items: [],
    });

    const discarded = await orchestrator.lead.discardPlan(plan.id);

    assert.equal(discarded.status, "rejected");
    assert.equal(discarded.feedback, undefined);
    assert.equal((await orchestrator.lead.conversation(project.id)).replying, false);

    const stuck = repository.createLeadMessage({
      projectId: project.id,
      role: "lead",
      content: "",
      status: "pending",
    });
    await orchestrator.lead.stopReply(project.id);
    const stopped = repository
      .listLeadMessages(project.id)
      .find((message) => message.id === stuck.id);
    assert.equal(stopped?.status, "failed");
    assert.match(stopped?.content ?? "", /멈췄어요/);
  } finally {
    repository.close();
  }
});
