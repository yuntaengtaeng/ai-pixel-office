import type { AgentModel } from "@ai-pixel-office/domain/entities";

export const MODEL_OPTIONS: Record<AgentModel, Array<{ value: string; label: string }>> = {
  codex: [
    { value: "gpt-5.6-luna", label: "Luna · 빠른 작업" },
    { value: "gpt-5.6-terra", label: "Terra · 균형" },
    { value: "gpt-5.6-sol", label: "Sol · 복잡한 작업" },
    { value: "gpt-6-astra", label: "Astra (GPT-6)" },
  ],
  claude: [
    { value: "haiku", label: "Haiku · 빠른 작업" },
    { value: "sonnet", label: "Sonnet · 균형" },
    { value: "opus", label: "Opus · 복잡한 작업" },
  ],
};

export function defaultManualModel(runtime: AgentModel): string {
  return runtime === "codex" ? "gpt-5.6-terra" : "sonnet";
}
