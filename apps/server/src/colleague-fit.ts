import { randomUUID } from "node:crypto";
import { DomainError, type AgentModel } from "@ai-pixel-office/domain";
import { PETS } from "@ai-pixel-office/pet";
import { ClaudeRuntimeAdapter } from "./runtime/claude.ts";
import { CodexRuntimeAdapter } from "./runtime/codex.ts";

export type ColleagueFit = {
  name: string;
  role: string;
  rationale: string;
  petIds: string[];
  petRationale: string;
};
const availablePets = PETS.filter(
  (pet) => !pet.unlock && (pet.species === "dog" || pet.species === "cat"),
);

// Models sometimes wrap the JSON answer in a ```json fenced block despite the
// "Return only JSON" instruction. Unwrap it before parsing instead of failing.
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1] : trimmed;
}

export async function generateColleagueFit(
  intent: string,
  runtime: AgentModel,
  cwd: string,
): Promise<ColleagueFit> {
  const adapter = runtime === "codex" ? new CodexRuntimeAdapter() : new ClaudeRuntimeAdapter();
  const petCatalog = availablePets
    .map((pet) => `${pet.id}: ${pet.species}, ${pet.breed}, ${pet.name}`)
    .join("\n");
  const prompt = [
    "You design one practical AI coworker for the user's first task.",
    "Do not perform the task. Do not use tools. Return only JSON.",
    "USER TASK",
    intent,
    "PET CATALOG",
    petCatalog,
    'Return: {"name":"short Korean coworker name","role":"specific Korean responsibility","rationale":"one Korean sentence","petIds":["one dog id","one cat id"],"petRationale":"one Korean sentence"}',
    "Choose exactly one unlocked dog and one unlocked cat from the catalog. Pet choice is personality only and must not imply higher work ability.",
  ].join("\n\n");
  const result = await adapter.run(
    {
      runId: randomUUID(),
      runtime,
      prompt,
      cwd,
      writable: false,
      browser: false,
      figma: false,
      conversational: false,
      limits: { maxDurationMs: 60_000, maxTurns: 1 },
    },
    { onEvent: () => undefined, onApprovalPending: () => undefined },
  );
  const completed = result.events.findLast((event) => event.type === "completed");
  if (completed?.type !== "completed") {
    const failed = result.events.findLast((event) => event.type === "failed");
    const detail = failed?.type === "failed" ? failed.error : undefined;
    throw new DomainError(
      "COLLEAGUE_FIT_FAILED",
      detail ? `동료 추천을 완성하지 못했습니다: ${detail}` : "동료 추천을 완성하지 못했습니다.",
      502,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(extractJson(completed.result.summary));
  } catch {
    const snippet = completed.result.summary.trim().slice(0, 300);
    throw new DomainError(
      "COLLEAGUE_FIT_INVALID",
      snippet ? `동료 추천 형식이 올바르지 않습니다: ${snippet}` : "동료 추천 형식이 올바르지 않습니다.",
      502,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DomainError("COLLEAGUE_FIT_INVALID", "동료 추천 형식이 올바르지 않습니다.", 502);
  const fit = value as Record<string, unknown>;
  const strings = ["name", "role", "rationale", "petRationale"] as const;
  if (strings.some((key) => typeof fit[key] !== "string" || !(fit[key] as string).trim()))
    throw new DomainError("COLLEAGUE_FIT_INVALID", "동료 추천에 필요한 내용이 없습니다.", 502);
  const petIds = Array.isArray(fit.petIds)
    ? fit.petIds.filter(
        (id): id is string => typeof id === "string" && availablePets.some((pet) => pet.id === id),
      )
    : [];
  const species = new Set(petIds.map((id) => availablePets.find((pet) => pet.id === id)?.species));
  if (!species.has("dog") || !species.has("cat"))
    throw new DomainError(
      "COLLEAGUE_FIT_INVALID",
      "강아지와 고양이 추천을 확인하지 못했습니다.",
      502,
    );
  return {
    name: (fit.name as string).trim(),
    role: (fit.role as string).trim(),
    rationale: (fit.rationale as string).trim(),
    petIds: [
      petIds.find((id) => availablePets.find((pet) => pet.id === id)?.species === "dog")!,
      petIds.find((id) => availablePets.find((pet) => pet.id === id)?.species === "cat")!,
    ],
    petRationale: (fit.petRationale as string).trim(),
  };
}
