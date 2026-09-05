import { useEffect, useState } from "react";
import type {
  Agent,
  AgentPermissions,
  ModelPolicy,
  ReasoningEffort,
  Skill,
} from "@ai-pixel-office/domain/entities";
import { PETS } from "@ai-pixel-office/pet";
import { toggle } from "../../../shared/lib/collections.ts";
import { defaultManualModel } from "../model-options.ts";

const DEFAULT_PERMISSIONS: AgentPermissions = { fileRead: true, fileWrite: true, terminal: true };

/**
 * Shared by AgentsPage (create) and AgentDetailPage (edit): both build the
 * same field set and the same skill-selection -> required-permission merge.
 * `agent` seeds the form from existing data when editing; omit it to create.
 */
export function useAgentForm(agent?: Agent) {
  const [name, setName] = useState(agent?.name ?? "");
  const [role, setRole] = useState(agent?.role ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [model, setModel] = useState<"codex" | "claude">(agent?.model ?? "codex");
  const [modelPolicy, setModelPolicy] = useState<ModelPolicy>(agent?.modelPolicy ?? "default");
  const [modelName, setModelName] = useState(
    agent?.modelName ?? defaultManualModel(agent?.model ?? "codex"),
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    agent?.reasoningEffort ?? "medium",
  );
  const [avatarId, setAvatarId] = useState(agent?.avatarId ?? PETS[0]!.id);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(agent?.skillIds ?? []);
  const [permissions, setPermissions] = useState<AgentPermissions>(
    agent
      ? {
          ...agent.permissions,
          fileRead: true,
          fileWrite: agent.mode === "chat" ? true : agent.permissions.fileWrite,
          terminal: true,
        }
      : DEFAULT_PERMISSIONS,
  );

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setRole(agent.role);
    setDescription(agent.description ?? "");
    setModel(agent.model);
    setModelPolicy(agent.modelPolicy ?? "default");
    setModelName(agent.modelName ?? defaultManualModel(agent.model));
    setReasoningEffort(agent.reasoningEffort ?? "medium");
    setAvatarId(agent.avatarId ?? PETS[0]!.id);
    setSelectedSkills(agent.skillIds);
    setPermissions({
      ...agent.permissions,
      fileRead: true,
      fileWrite: agent.mode === "chat" ? true : agent.permissions.fileWrite,
      terminal: true,
    });
  }, [agent]);

  const toggleSkill = (skill: Skill) => {
    const selecting = !selectedSkills.includes(skill.id);
    setSelectedSkills(toggle(selectedSkills, skill.id));
    if (selecting)
      setPermissions((current) =>
        (skill.requiredPermissions ?? []).reduce(
          (next, permission) => ({ ...next, [permission]: true }),
          { ...current, fileRead: true, terminal: true },
        ),
      );
  };

  const reset = () => {
    setName("");
    setRole("");
    setSelectedSkills([]);
    setPermissions(DEFAULT_PERMISSIONS);
  };

  return {
    name,
    setName,
    role,
    setRole,
    description,
    setDescription,
    model,
    setModel,
    modelPolicy,
    setModelPolicy,
    modelName,
    setModelName,
    reasoningEffort,
    setReasoningEffort,
    avatarId,
    setAvatarId,
    selectedSkills,
    setSelectedSkills,
    permissions,
    setPermissions,
    toggleSkill,
    reset,
  };
}
