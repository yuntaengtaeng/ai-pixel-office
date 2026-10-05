import assert from "node:assert/strict";
import test from "node:test";
import type { Agent } from "@ai-pixel-office/domain";
import { groupAgentsByTeam } from "../apps/web/src/features/agents/utils/orgChart.ts";

function agent(name: string, sourceTeam?: string): Agent {
  return {
    id: name,
    workspaceId: "w",
    name,
    role: "role",
    model: "claude",
    mode: "worker",
    skillIds: [],
    permissions: {},
    ...(sourceTeam ? { sourceTeam } : {}),
    createdAt: "",
    updatedAt: "",
  };
}

test("groups colleagues under the team they were created from", () => {
  const { teams, unaffiliated } = groupAgentsByTeam(
    [agent("라떼", "product-team@0.1.0"), agent("시바"), agent("모카", "product-team@0.2.0")],
    [{ id: "product-team" }, { id: "research-team" }],
  );

  assert.deepEqual(
    teams.map(({ team, members }) => [team.id, members.map((member) => member.name)]),
    [
      ["product-team", ["라떼", "모카"]],
      ["research-team", []],
    ],
  );
  assert.deepEqual(
    unaffiliated.map((member) => member.name),
    ["시바"],
  );
});
