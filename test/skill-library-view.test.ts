import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, Skill } from "@ai-pixel-office/domain";
import {
  agentsBySkill,
  filterSkillsBySource,
  skillRemovalBlocker,
} from "../apps/web/src/features/skills/utils/skillLibraryView.ts";

function skill(id: string, source: Skill["source"]): Skill {
  return { id, name: id, description: id, category: "기타", source, files: [], updatedAt: "" };
}

function agent(name: string, skillIds: string[]): Agent {
  return {
    id: name,
    workspaceId: "w",
    name,
    role: "role",
    model: "claude",
    mode: "worker",
    skillIds,
    permissions: {},
    createdAt: "",
    updatedAt: "",
  };
}

test("filters skills by where they came from", () => {
  const skills = [skill("a", "bundled"), skill("b", "local")];
  assert.deepEqual(
    filterSkillsBySource(skills, "local").map((item) => item.id),
    ["b"],
  );
  assert.equal(filterSkillsBySource(skills, "all").length, 2);
});

test("lists which colleagues use each skill", () => {
  const usage = agentsBySkill([agent("라떼", ["a", "b"]), agent("모카", ["b"])]);
  assert.deepEqual(
    usage.get("b")?.map((item) => item.name),
    ["라떼", "모카"],
  );
  assert.equal(usage.get("c"), undefined);
});

test("explains why a skill cannot be removed", () => {
  assert.match(skillRemovalBlocker(skill("a", "bundled"), []) ?? "", /팀과 함께 설치/);
  assert.match(skillRemovalBlocker(skill("b", "local"), [agent("라떼", ["b"])]) ?? "", /라떼/);
  assert.equal(skillRemovalBlocker(skill("c", "local"), []), undefined);
});
