import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DomainError } from "@ai-pixel-office/domain";
import { parseFrontmatter, SkillLibrary } from "../apps/server/src/skill-library.ts";

function createLibrary(context: test.TestContext): { library: SkillLibrary; root: string } {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-skills-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return { library: new SkillLibrary(join(root, "library")), root };
}

function writeBundledSkill(root: string, id: string, description: string): string {
  const directory = join(root, "bundle", id);
  mkdirSync(join(directory, "templates"), { recursive: true });
  writeFileSync(
    join(directory, "SKILL.md"),
    `---\nname: ${id}\ndescription: ${description}\n---\n\nBody of ${id}\n`,
  );
  writeFileSync(join(directory, "templates", "handoff.yaml"), "type: handoff\n");
  return directory;
}

test("creates a local skill as a standard SKILL.md folder", (context) => {
  const { library } = createLibrary(context);

  const skill = library.create({
    title: "Brand Voice",
    category: "Writing",
    description: "우리 서비스 문구 톤: 짧고 친근하게",
    instructions: "# Brand voice\n존댓말을 쓴다.",
    requiredPermissions: ["fileRead"],
  });

  assert.equal(skill.id, "brand-voice");
  assert.equal(skill.name, "Brand Voice");
  assert.equal(skill.source, "local");
  const file = readFileSync(join(library.skillsRoot, "brand-voice", "SKILL.md"), "utf8");
  const { attributes, body } = parseFrontmatter(file);
  assert.equal(attributes.name, "brand-voice");
  assert.equal(attributes.description, "우리 서비스 문구 톤: 짧고 친근하게");
  assert.equal(body, "# Brand voice\n존댓말을 쓴다.");
  assert.deepEqual(
    library.list().map((item) => item.id),
    ["brand-voice"],
  );
});

test("refuses a second skill with the same id", (context) => {
  const { library } = createLibrary(context);
  const input = {
    id: "review",
    title: "Review",
    category: "QA",
    description: "d",
    instructions: "i",
  };
  library.create(input);

  assert.throws(
    () => library.create(input),
    (error) => error instanceof DomainError && error.code === "SKILL_EXISTS",
  );
});

test("installs bundled team skills that cannot be removed", (context) => {
  const { library, root } = createLibrary(context);
  const source = writeBundledSkill(root, "user-flow-modeling", "Define user flows");

  const skill = library.installBundled(source, {
    teamId: "product-team",
    version: "0.1.0",
    category: "Product Team",
  });

  assert.equal(skill.source, "bundled");
  assert.equal(skill.teamId, "product-team");
  assert.deepEqual(skill.files, ["templates/handoff.yaml"]);
  assert.throws(
    () => library.remove("user-flow-modeling"),
    (error) => error instanceof DomainError && error.code === "SKILL_BUNDLED",
  );
});

test("prepares a run folder that contains only the selected skills", (context) => {
  const { library } = createLibrary(context);
  library.create({
    id: "alpha",
    title: "Alpha",
    category: "A",
    description: "a",
    instructions: "a",
  });
  library.create({ id: "beta", title: "Beta", category: "B", description: "b", instructions: "b" });

  const bundle = library.prepareRun("run-1", ["alpha"]);

  assert.ok(bundle);
  assert.deepEqual(readdirSync(bundle.skillsRoot), ["alpha"]);
  const plugin = JSON.parse(
    readFileSync(join(bundle.pluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
  );
  assert.equal(plugin.name, "pixel-office-library");
  library.releaseRun("run-1");
  assert.equal(existsSync(bundle.pluginRoot), false);
});

test("prepares nothing for an agent without skills", (context) => {
  const { library } = createLibrary(context);
  assert.equal(library.prepareRun("run-2", []), undefined);
});
