import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  Button,
  Dialog,
  Field,
  HelperText,
  Input,
  Kicker,
  TextArea,
  useDialogIds,
} from "@ai-pixel-office/design-system";
import type { AgentModel } from "@ai-pixel-office/domain/entities";
import { PETS } from "@ai-pixel-office/pet";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { skillApi } from "../../skills/api.ts";
import { agentApi } from "../api.ts";
import { useAgentForm } from "../hooks/useAgentForm.ts";
import { AgentAdvancedOptions } from "./AgentAdvancedOptions.tsx";
import { AgentSkillsField } from "./AgentSkillsField.tsx";
import { PetChoice } from "./PetChoice.tsx";

const SELECTABLE_PETS = PETS.filter((pet) => !pet.unlock);
const RUNTIME_LABEL: Record<AgentModel, string> = { claude: "Claude", codex: "Codex" };

const Styled = {
  Dialog: styled(Dialog)`
    .dialog-content {
      width: min(760px, calc(100vw - 28px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
    }
  `,
  Form: styled.form`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    h2 {
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
    }
  `,
  Row: styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x3};
  `,
  Runtimes: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.space.x2};
    button {
      min-height: 40px;
      padding: ${({ theme }) => `0 ${theme.space.x4}`};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      border-radius: ${({ theme }) => theme.radius.md};
      background: transparent;
      color: ${({ theme }) => theme.colors.text.secondary};
      cursor: pointer;
    }
    button[aria-pressed="true"] {
      border-color: ${({ theme }) => theme.colors.action.primary.background};
      background: ${({ theme }) => theme.colors.action.primary.background};
      color: ${({ theme }) => theme.colors.action.primary.foreground};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
  Character: styled.details`
    summary {
      color: ${({ theme }) => theme.colors.text.secondary};
      cursor: pointer;
    }
  `,
  PetGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x3};
  `,
  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
};

/** 동료 추가 대화상자 (런타임, 지침, 스킬, 권한이 핵심이고 캐릭터는 선택) */
export function NewColleagueDialog({
  open,
  onOpenChange,
  workspaceId,
  connectedRuntimes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  connectedRuntimes: AgentModel[];
}) {
  const queryClient = useQueryClient();
  const { titleId, descriptionId } = useDialogIds();
  const form = useAgentForm();
  const [instructions, setInstructions] = useState("");
  const skills = useQuery({ queryKey: ["skills"], queryFn: () => skillApi.list() });
  const runtime = connectedRuntimes.includes(form.model) ? form.model : connectedRuntimes[0];
  const create = useMutation({
    mutationFn: () =>
      agentApi.create({
        workspaceId,
        name: form.name,
        role: form.role,
        model: runtime ?? form.model,
        modelPolicy: form.modelPolicy,
        modelName: form.modelPolicy === "manual" ? form.modelName : undefined,
        reasoningEffort: form.modelPolicy === "manual" ? form.reasoningEffort : undefined,
        mode: "worker",
        avatarId: form.avatarId,
        skillIds: form.selectedSkills,
        permissions: { ...form.permissions, fileRead: true, terminal: true },
        ...(instructions.trim() ? { systemPrompt: instructions.trim() } : {}),
      }),
    onSuccess: () => {
      form.reset();
      setInstructions("");
      void queryClient.invalidateQueries({ queryKey: ["agents", workspaceId] });
      onOpenChange(false);
    },
  });
  const canCreate = Boolean(form.name.trim() && form.role.trim() && runtime);

  return (
    <Styled.Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <Styled.Form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <Kicker>동료 추가</Kicker>
          <h2 id={titleId}>새 동료</h2>
          <HelperText id={descriptionId}>
            동료는 어떤 AI로 일하는지, 어떤 지침과 스킬로 일하는지로 정해져요. 캐릭터는
            겉모습이에요.
          </HelperText>
        </div>
        <Styled.Row>
          <Field>
            <label htmlFor="colleague-name">이름</label>
            <Input
              id="colleague-name"
              value={form.name}
              onChange={(event) => form.setName(event.target.value)}
              required
            />
          </Field>
          <Field>
            <label htmlFor="colleague-role">역할</label>
            <Input
              id="colleague-role"
              value={form.role}
              onChange={(event) => form.setRole(event.target.value)}
              placeholder="예: Frontend Developer"
              required
            />
          </Field>
        </Styled.Row>
        <Field>
          <label>일하는 AI</label>
          <Styled.Runtimes role="group" aria-label="일하는 AI">
            {(["claude", "codex"] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={runtime === candidate}
                disabled={!connectedRuntimes.includes(candidate)}
                onClick={() => form.setModel(candidate)}
              >
                {RUNTIME_LABEL[candidate]}
              </button>
            ))}
          </Styled.Runtimes>
          {!runtime && <HelperText>AI를 연결해야 동료를 만들 수 있어요.</HelperText>}
        </Field>
        <Field>
          <label htmlFor="colleague-instructions">지침</label>
          <TextArea
            id="colleague-instructions"
            rows={5}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="이 동료가 항상 지킬 일하는 방식과 하지 말아야 할 일을 적어 주세요."
          />
        </Field>
        <AgentSkillsField
          skills={skills.data ?? []}
          selectedSkills={form.selectedSkills}
          onToggleSkill={form.toggleSkill}
        />
        <AgentAdvancedOptions
          model={runtime ?? form.model}
          setModel={form.setModel}
          modelPolicy={form.modelPolicy}
          setModelPolicy={form.setModelPolicy}
          modelName={form.modelName}
          setModelName={form.setModelName}
          reasoningEffort={form.reasoningEffort}
          setReasoningEffort={form.setReasoningEffort}
          permissions={form.permissions}
          setPermissions={form.setPermissions}
          availableModels={connectedRuntimes}
        />
        <Styled.Character>
          <summary>캐릭터 고르기 (선택)</summary>
          <Styled.PetGrid>
            {SELECTABLE_PETS.map((pet) => (
              <PetChoice
                key={pet.id}
                pet={pet}
                selected={form.avatarId === pet.id}
                onSelect={form.setAvatarId}
              />
            ))}
          </Styled.PetGrid>
        </Styled.Character>
        {create.isError && <ErrorBanner>{messageOf(create.error)}</ErrorBanner>}
        <Styled.Actions>
          <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="submit" $variant="primary" disabled={!canCreate || create.isPending}>
            동료 추가
          </Button>
        </Styled.Actions>
      </Styled.Form>
    </Styled.Dialog>
  );
}
