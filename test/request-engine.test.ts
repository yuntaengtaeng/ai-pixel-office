import assert from "node:assert/strict";
import test from "node:test";
import {
  checkOutputContract,
  readResultBlock,
  requiredFields,
} from "../apps/server/src/request-engine/output-contract.ts";
import {
  decideAfterRun,
  type CompletedRunFacts,
} from "../apps/server/src/request-engine/run-decision.ts";
import {
  detectPackageManager,
  matchVerificationCommand,
  suggestVerificationCommands,
  verificationFacts,
} from "../apps/server/src/request-engine/verification.ts";
import { buildRunGuidance } from "../apps/server/src/request-engine/run-guidance.ts";
import { collectRunFacts } from "../apps/server/src/request-engine/run-facts.ts";
import { isLoopbackHost } from "../apps/server/src/loopback-host.ts";

function completeUxResult(userQuestions: unknown[] = []): Record<string, unknown> {
  return Object.fromEntries(
    requiredFields("ux").map((field) => [field, field === "user_questions" ? userQuestions : "x"]),
  );
}

const baseFacts: CompletedRunFacts = {
  contract: { status: "complete", userQuestions: [] },
  verifications: [],
  verificationRetryUsed: false,
  hasFileChanges: false,
};

test("a result is complete only with every handoff field plus user_questions", () => {
  assert.deepEqual(checkOutputContract("ux", completeUxResult()), {
    status: "complete",
    userQuestions: [],
  });
  const partial = Object.fromEntries(
    Object.entries(completeUxResult()).filter(
      ([field]) => field !== "user_questions" && field !== "problem",
    ),
  );
  assert.deepEqual(checkOutputContract("ux", partial), {
    status: "incomplete",
    missingFields: ["problem", "user_questions"],
  });
  assert.deepEqual(checkOutputContract("ux", "just a summary"), { status: "missing" });
  assert.deepEqual(checkOutputContract(undefined, undefined), { status: "not_required" });
});

test("user questions can be plain strings or objects with a question", () => {
  const check = checkOutputContract(
    "ux",
    completeUxResult(["건너뛰기 버튼을 둘까요?", { question: "로그인은 필수인가요?" }, ""]),
  );
  assert.deepEqual(check, {
    status: "complete",
    userQuestions: ["건너뛰기 버튼을 둘까요?", "로그인은 필수인가요?"],
  });
});

test("reads the last pixel-office-result block from a final answer", () => {
  const text =
    'draft\n```pixel-office-result\n{"status":"draft"}\n```\nfinal\n```pixel-office-result\n{"status":"done"}\n```';
  assert.deepEqual(readResultBlock(text), { status: "done" });
  assert.equal(readResultBlock("no block here"), undefined);
  assert.equal(readResultBlock("```pixel-office-result\nnot json\n```"), undefined);
});

test("stops for a missing or incomplete result before anything else", () => {
  assert.deepEqual(decideAfterRun({ ...baseFacts, contract: { status: "missing" } }), {
    kind: "stop_incomplete_result",
    missingFields: [],
  });
  assert.deepEqual(
    decideAfterRun({
      ...baseFacts,
      contract: { status: "incomplete", missingFields: ["states"] },
      hasFileChanges: true,
    }),
    { kind: "stop_incomplete_result", missingFields: ["states"] },
  );
});

test("asks the user when the result left questions only the user can answer", () => {
  assert.deepEqual(
    decideAfterRun({
      ...baseFacts,
      contract: { status: "complete", userQuestions: ["건너뛰기 버튼을 둘까요?"] },
    }),
    { kind: "ask_user", questions: ["건너뛰기 버튼을 둘까요?"] },
  );
});

test("sends a failed check back to the same colleague once, then stops", () => {
  const verifications = [
    { command: "pnpm test", passed: false },
    { command: "pnpm lint", passed: true },
  ];
  assert.deepEqual(decideAfterRun({ ...baseFacts, verifications }), {
    kind: "return_to_assignee",
    failed: [{ command: "pnpm test", passed: false }],
  });
  assert.deepEqual(decideAfterRun({ ...baseFacts, verifications, verificationRetryUsed: true }), {
    kind: "stop_verification_failed",
    failed: [{ command: "pnpm test", passed: false }],
  });
});

test("goes to approval only when files changed", () => {
  assert.deepEqual(decideAfterRun({ ...baseFacts, hasFileChanges: true }), {
    kind: "final_review",
  });
  assert.deepEqual(decideAfterRun({ ...baseFacts, contract: { status: "not_required" } }), {
    kind: "complete_without_approval",
  });
});

test("counts only the project's check commands as verification, however they are spelled", () => {
  const commands = ["pnpm test", "pnpm typecheck"];
  assert.equal(matchVerificationCommand("pnpm run test", commands), "pnpm test");
  assert.equal(
    matchVerificationCommand("cd apps/web && pnpm  typecheck", commands),
    "pnpm typecheck",
  );
  assert.equal(matchVerificationCommand("pnpm test:e2e", commands), undefined);
  assert.equal(matchVerificationCommand("rm -rf dist", commands), undefined);
});

test("suggests check commands from package scripts with the project's package manager", () => {
  const scripts = { dev: "vite", test: "vitest", lint: "eslint .", typecheck: "tsc" };
  assert.deepEqual(suggestVerificationCommands(scripts, "pnpm"), [
    "pnpm typecheck",
    "pnpm lint",
    "pnpm test",
  ]);
  assert.deepEqual(suggestVerificationCommands(scripts, "npm"), [
    "npm run typecheck",
    "npm run lint",
    "npm test",
  ]);
});

test("picks the workspace setup command from the lockfile", () => {
  assert.deepEqual(detectPackageManager(["package.json", "pnpm-lock.yaml"]), {
    packageManager: "pnpm",
    setupCommand: "pnpm install --frozen-lockfile",
  });
  assert.deepEqual(detectPackageManager(["package.json", "package-lock.json"]), {
    packageManager: "npm",
    setupCommand: "npm ci",
  });
  assert.equal(detectPackageManager(["README.md"]), undefined);
});

test("keeps only the last result of each project check a colleague ran", () => {
  assert.deepEqual(
    verificationFacts(
      [
        { command: "pnpm test", succeeded: false },
        { command: "ls", succeeded: true },
        { command: "pnpm run test", succeeded: true },
        { command: "pnpm lint", succeeded: false },
      ],
      ["pnpm test", "pnpm lint"],
    ),
    [
      { command: "pnpm test", passed: true },
      { command: "pnpm lint", passed: false },
    ],
  );
});

test("run guidance carries project notes, checks and the result format", () => {
  const guidance = buildRunGuidance({
    resultFormat: "ui",
    projectMemo: "글자는 크게",
    verificationCommands: ["pnpm test"],
  });
  assert.match(guidance, /PROJECT NOTES\n글자는 크게/);
  assert.match(guidance, /- pnpm test/);
  assert.match(guidance, /screen_hierarchy/);
  assert.match(guidance, /user_questions/);
  assert.match(guidance, /report_result/);
  assert.match(guidance, /```pixel-office-result/);
});

test("run guidance stays empty when there is nothing to add", () => {
  assert.equal(buildRunGuidance({ verificationCommands: [] }), "");
});

test("collects the reported result, commands and changed files from a run", () => {
  const facts = collectRunFacts(
    [
      { type: "command_finished", command: "pnpm test", succeeded: true },
      { type: "files_changed", paths: ["a.ts", "b.ts"] },
      { type: "files_changed", paths: ["a.ts"] },
      { type: "result_reported", result: { status: "done" } },
    ],
    '```pixel-office-result\n{"status":"from block"}\n```',
  );
  assert.deepEqual(facts, {
    reportedResult: { status: "done" },
    commands: [{ command: "pnpm test", succeeded: true }],
    changedPaths: ["a.ts", "b.ts"],
  });
});

test("falls back to the final answer's result block when nothing was reported", () => {
  assert.deepEqual(collectRunFacts([], '```pixel-office-result\n{"status":"block"}\n```'), {
    reportedResult: { status: "block" },
    commands: [],
    changedPaths: [],
  });
  assert.deepEqual(collectRunFacts([], "plain answer"), { commands: [], changedPaths: [] });
});

test("accepts only requests addressed to this computer", () => {
  assert.equal(isLoopbackHost("127.0.0.1:47372"), true);
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("[::1]:47372"), true);
  assert.equal(isLoopbackHost("evil.example:47372"), false);
  assert.equal(isLoopbackHost("127.0.0.1.evil.example"), false);
  assert.equal(isLoopbackHost(undefined), false);
});
