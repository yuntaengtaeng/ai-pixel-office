import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectProjectRuntimeContext } from "../apps/server/src/project-context.ts";

test("detects only the selected runtime's project instructions and skills", () => {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-context-"));
  const web = join(root, "apps", "web");
  try {
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, ".agents", "skills", "codex-review"), { recursive: true });
    mkdirSync(join(root, ".claude", "skills", "claude-review"), { recursive: true });
    mkdirSync(web, { recursive: true });
    writeFileSync(join(root, "AGENTS.md"), "Codex instructions");
    writeFileSync(join(root, "CLAUDE.md"), "Claude instructions");
    writeFileSync(join(root, ".agents", "skills", "codex-review", "SKILL.md"), "codex");
    writeFileSync(join(root, ".claude", "skills", "claude-review", "SKILL.md"), "claude");

    const codex = inspectProjectRuntimeContext("codex", web);
    assert.deepEqual(codex.instructionFiles, [join(root, "AGENTS.md")]);
    assert.deepEqual(
      codex.projectSkills.map((skill) => skill.name),
      ["codex-review"],
    );

    const claude = inspectProjectRuntimeContext("claude", web);
    assert.deepEqual(claude.instructionFiles, [join(root, "CLAUDE.md")]);
    assert.deepEqual(
      claude.projectSkills.map((skill) => skill.name),
      ["claude-review"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
