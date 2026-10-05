import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowResetNotice } from "../apps/web/src/features/system/resetNotice.ts";
import { chooseTeamRuntime } from "../apps/web/src/features/teams/api.ts";

test("prefers Claude when choosing the runtime for a new team", () => {
  assert.equal(chooseTeamRuntime(["codex", "claude"]), "claude");
  assert.equal(chooseTeamRuntime(["codex"]), "codex");
  assert.equal(chooseTeamRuntime([]), undefined);
});

test("shows the data reset notice once per reset", () => {
  assert.equal(shouldShowResetNotice(undefined, null), false);
  assert.equal(shouldShowResetNotice("2026-10-04T00:00:00Z", null), true);
  assert.equal(shouldShowResetNotice("2026-10-04T00:00:00Z", "2026-10-04T00:00:00Z"), false);
});
