import type { Agent, ModelPolicy, ReasoningEffort, Task } from "@ai-pixel-office/domain";

export type ModelSelection = {
  policy: ModelPolicy;
  modelName?: string;
  reasoningEffort?: ReasoningEffort;
};

const AUTO_ROUTES = {
  codex: {
    low: { modelName: "gpt-5.6-luna", reasoningEffort: "low" },
    medium: { modelName: "gpt-5.6-terra", reasoningEffort: "medium" },
    high: { modelName: "gpt-5.6-sol", reasoningEffort: "high" },
  },
  claude: {
    low: { modelName: "haiku", reasoningEffort: "low" },
    medium: { modelName: "sonnet", reasoningEffort: "medium" },
    high: { modelName: "opus", reasoningEffort: "high" },
  },
} as const satisfies Record<
  Agent["model"],
  Record<NonNullable<Task["priority"]>, Omit<ModelSelection, "policy">>
>;

export function selectModel(agent: Agent, task: Task): ModelSelection {
  const policy = agent.modelPolicy ?? "default";
  if (policy === "default") return { policy };
  if (policy === "manual") {
    return {
      policy,
      ...(agent.modelName ? { modelName: agent.modelName } : {}),
      ...(agent.reasoningEffort ? { reasoningEffort: agent.reasoningEffort } : {}),
    };
  }
  return { policy, ...AUTO_ROUTES[agent.model][task.priority ?? "medium"] };
}
