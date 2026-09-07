import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const personas = [
  "junior-frontend-developer",
  "senior-platform-developer",
  "startup-product-manager",
  "enterprise-project-manager",
  "product-designer",
  "qa-engineer",
  "solo-creator",
  "nontechnical-office-worker",
  "accessibility-first-user",
  "career-switching-student",
];
const required = [
  "README.md", "team.yaml", "AGENTS.md", "CLAUDE.md", "agents/research-lead.md",
  "agents/personas/index.md", "instructions/command-contract.md", "instructions/test-protocol.md",
  "instructions/data-safety.md", "instructions/reporting-contract.md", "templates/test-plan.yaml",
  "templates/session-note.yaml", "templates/checkpoint.yaml", "templates/usability-report.yaml",
  ...personas.map((name) => `agents/personas/${name}.md`),
];
const failures = required.filter((path) => !existsSync(join(root, path)));
const manifest = readFileSync(join(root, "team.yaml"), "utf8");
for (const persona of personas) {
  if (!manifest.includes(`  - ${persona}`)) failures.push(`team.yaml missing ${persona}`);
}
if (personas.length !== 10) failures.push("persona roster must contain exactly 10 personas");
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Usability team package structure is valid\n");
}
