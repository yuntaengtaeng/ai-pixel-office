import { mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  BackButton,
  Button,
  Field,
  Fieldset,
  HelperText,
  Input,
  Kicker,
  Legend,
  Panel,
  Select,
  TextArea,
  TrashIcon,
} from "@ai-pixel-office/design-system";
import type {
  AgentPermissions,
  ModelPolicy,
  ReasoningEffort,
  Skill,
  TaskStatus,
  Workspace,
} from "@ai-pixel-office/domain/entities";
import { taskApi } from "../tasks/api.ts";
import { skillApi } from "../skills/api.ts";
import { agentApi } from "./api.ts";
import { PETS } from "@ai-pixel-office/pet";
import { PetPreview } from "../office/PetPreview.tsx";
import { PERMISSIONS, STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { toggle } from "../../shared/lib/collections.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { ProjectDirectorySelect } from "../projects/ProjectSelect.tsx";
import { ModelPolicyFields } from "./ModelPolicyFields.tsx";
import { defaultManualModel } from "./model-options.ts";

const Styled = {
  StatusPill: styled.span<{ $status: TaskStatus }>`
    display: inline-block;
    padding: 4px 8px;
    border: 2px solid currentColor;
    border-top-color: ${({ $status }) => STATUS[$status].color};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  `,
  Roster: styled(Panel).attrs({ as: "section" })`
    margin-top: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x5};
  `,
  RosterGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    @media ${mediaQuery.xl} {
      grid-template-columns: repeat(2, 1fr);
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  AgentCard: styled.article<{ $selected: boolean }>`
    position: relative;
    width: 100%;
    padding: 0;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    text-align: left;

    ${({ $selected, theme }) =>
      $selected &&
      `
        border-color: ${theme.colors.border.positive};
        background: ${theme.colors.background.positiveSubtle};
        box-shadow: 3px 3px 0 ${theme.colors.shadow.positive};
      `}

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.shadow.positive};
    }

    > button {
      width: 100%;
      padding: 12px 12px 44px;
      border: 0;
      background: transparent;
      display: flex;
      gap: 12px;
      align-items: center;
      text-align: left;
      cursor: pointer;
    }

    div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.base};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    small {
      color: ${({ theme }) => theme.colors.text.positive};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  AgentCardActions: styled.div`
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex !important;
    grid-auto-flow: column;
    gap: 4px !important;

    a,
    button {
      padding: 4px 8px;
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;
    }

    button {
      border-color: ${({ theme }) => theme.colors.border.negative};
      background: ${({ theme }) => theme.colors.background.negativeSubtle};
      color: ${({ theme }) => theme.colors.text.negative};
    }
  `,
  QuickJobs: styled(Panel).attrs({ as: "section" })`
    margin-top: ${({ theme }) => theme.space.x5};
    padding: ${({ theme }) => theme.space.x5};
  `,
  QuickJobList: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    @media ${mediaQuery.xl} {
      grid-template-columns: repeat(2, 1fr);
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  QuickJob: styled.div`
    display: grid;
    grid-template-columns: 1fr 30px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surface};

    > button:first-child {
      min-width: 0;
      padding: 12px;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
      display: grid;
      gap: 4px;
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `,
  RemoveQuickJobButton: styled.button`
    border: 0;
    border-left: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.negative};
    display: grid;
    place-items: center;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    &:hover {
      background: ${({ theme }) => theme.colors.background.negativeSubtle};
      color: ${({ theme }) => theme.colors.text.negative};
    }
  `,
  RecentJobs: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.muted};

    button {
      padding: 4px 8px;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      cursor: pointer;
    }
  `,
  QuickJobForm: styled.form`
    display: flex;
    align-items: end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed ${({ theme }) => theme.colors.border.subtle};

    @media ${mediaQuery.md} {
      display: grid;
    }
  `,
  DetailGrid: styled.div`
    display: grid;
    grid-template-columns: minmax(310px, 0.85fr) minmax(0, 1.15fr);
    gap: 20px;
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  DetailSide: styled.div`
    display: grid;
    gap: 16px;
  `,
  ProfileStats: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    div {
      padding: 12px;
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      text-align: center;
      display: grid;
      gap: 4px;
    }

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.headingXl};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  ProfilePanel: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
  `,
  TemplateList: styled.div`
    display: grid;
    gap: 8px;

    > div {
      display: grid;
      grid-template-columns: 1fr 30px;
      border: 1px solid ${({ theme }) => theme.colors.border.subtle};

      > div {
        min-width: 0;
        padding: 8px;
        display: grid;
        gap: 4px;
      }
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    button {
      width: 34px;
      border: 0;
      border-left: 1px solid ${({ theme }) => theme.colors.border.subtle};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.negative};
      display: grid;
      place-items: center;
      cursor: pointer;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      &:hover {
        background: ${({ theme }) => theme.colors.background.negativeSubtle};
        color: ${({ theme }) => theme.colors.text.negative};
      }
    }
  `,
  TemplateForm: styled.form`
    display: grid;
    grid-template-columns: 0.7fr 1fr auto;
    gap: 8px;
    margin-top: 12px;

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  TaskList: styled.div`
    display: grid;

    > a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 8px 4px;
      border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
    }

    strong {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    time {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  BuilderLayout: styled.div`
    display: grid;
    grid-template-columns: minmax(280px, 0.75fr) minmax(520px, 1.45fr);
    gap: 20px;
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  BuilderForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x6};
    display: grid;
    gap: ${({ theme }) => theme.space.x5};

    h2 {
      margin: 0;
    }
  `,
  SelectedPet: styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    padding: 12px;
    border: 2px solid ${({ theme }) => theme.colors.border.default};

    div {
      display: grid;
      gap: 4px;

      > span {
        color: ${({ theme }) => theme.colors.text.secondary};
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.sm};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.headingLg};
    }

    small {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
  CheckGrid: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  CheckChip: styled.label`
    position: relative;

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    span {
      display: block;
      padding: 8px 8px;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      cursor: pointer;
    }

    input:checked + span {
      color: ${({ theme }) => theme.colors.text.positive};
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
      box-shadow: inset 3px 0 ${({ theme }) => theme.colors.brand.primary};
    }
  `,
  EnginePicker: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    button {
      padding: 12px;
      display: grid;
      gap: 4px;
      border: 2px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};

      &.selected {
        border-color: ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
        color: ${({ theme }) => theme.colors.text.positive};
      }
    }

    small {
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    }
  `,
  AdvancedOptions: styled.details`
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > summary {
      padding: 12px 12px;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;
    }

    > div {
      padding: 12px;
      border-top: 1px dashed ${({ theme }) => theme.colors.border.default};
      display: grid;
      gap: 16px;
    }
  `,
  MappedPermissions: styled.div`
    margin-top: 8px;
    padding: 8px;
    border-left: 3px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    display: grid;
    gap: 8px;

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }

    > div {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    span {
      padding: 4px 8px;
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  AvatarLibrary: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x6};

    h3 {
      margin: 20px 0 8px;
      font-size: ${({ theme }) => theme.typography.fontSize.base};
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
  PetGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;

    @media ${mediaQuery.md} {
      grid-template-columns: repeat(3, 1fr);
    }
  `,
  PetChoice: styled.button<{ $selected: boolean }>`
    min-width: 0;
    padding: 8px 4px;
    border: 2px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.default};
    }

    ${({ $selected, theme }) =>
      $selected &&
      `
        border-color: ${theme.colors.border.positive};
        background: ${theme.colors.background.surfaceMuted};
        box-shadow: 3px 3px 0 ${theme.colors.border.positive};
      `}

    strong {
      margin-top: 4px;
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    span {
      margin-top: 4px;
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      overflow: hidden;
      white-space: nowrap;
      width: 100%;
    }
  `,
};

export function AgentsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [avatarId, setAvatarId] = useState(PETS[0]!.id);
  const [model, setModel] = useState<"codex" | "claude">("codex");
  const [modelPolicy, setModelPolicy] = useState<ModelPolicy>("default");
  const [modelName, setModelName] = useState(defaultManualModel("codex"));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<AgentPermissions>({
    fileRead: true,
    fileWrite: true,
    terminal: true,
  });
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const templates = useQuery({
    queryKey: ["agent-task-templates", selectedAgentId],
    queryFn: () => agentApi.listTaskTemplates(selectedAgentId),
    enabled: Boolean(selectedAgentId),
  });
  useEffect(() => {
    if (!selectedAgentId && agents.data?.[0]) setSelectedAgentId(agents.data[0].id);
  }, [agents.data, selectedAgentId]);
  const mutation = useMutation({
    mutationFn: () =>
      agentApi.create({
        workspaceId: workspace.id,
        name,
        role,
        model,
        modelPolicy,
        modelName: modelPolicy === "manual" ? modelName : undefined,
        reasoningEffort: modelPolicy === "manual" ? reasoningEffort : undefined,
        mode: "worker",
        avatarId,
        skillIds: selectedSkills,
        permissions: { ...permissions, fileRead: true, terminal: true },
        workingDirectory: workingDirectory.trim() || undefined,
      }),
    onSuccess: (agent) => {
      setName("");
      setRole("");
      setWorkingDirectory("");
      setSelectedSkills([]);
      setPermissions({ fileRead: true, fileWrite: true, terminal: true });
      setSelectedAgentId(agent.id);
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
    },
  });
  const selectedPet = PETS.find((pet) => pet.id === avatarId)!;
  const mappedSkillPermissions = Array.from(
    new Set(
      (skills.data ?? [])
        .filter((skill) => selectedSkills.includes(skill.id))
        .flatMap((skill) => skill.requiredPermissions ?? []),
    ),
  );
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
  const selectedAgent = agents.data?.find((agent) => agent.id === selectedAgentId);
  const quickTask = useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
    }) => taskApi.create({ ...input, workspaceId: workspace.id, assigneeAgentId: selectedAgentId }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const saveTemplate = useMutation({
    mutationFn: () =>
      agentApi.createTaskTemplate(selectedAgentId, {
        title: templateTitle,
        description: templateDescription || undefined,
      }),
    onSuccess: () => {
      setTemplateTitle("");
      setTemplateDescription("");
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", selectedAgentId] });
    },
  });
  const removeTemplate = useMutation({
    mutationFn: (id: string) => agentApi.deleteTaskTemplate(selectedAgentId, id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", selectedAgentId] }),
  });
  const removeAgent = useMutation({
    mutationFn: (id: string) => agentApi.remove(id),
    onSuccess: (_result, deletedId) => {
      if (selectedAgentId === deletedId) setSelectedAgentId("");
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
    },
  });
  const recentJobs = Array.from(
    new Map(
      (tasks.data ?? [])
        .filter((task) => task.assigneeAgentId === selectedAgentId)
        .map((task) => [task.title, task]),
    ).values(),
  ).slice(0, 3);
  return (
    <BaseLayout>
      <PageHeader eyebrow="TEAM BUILDER" title="AI 동료 만들기" />
      <Styled.BuilderLayout>
        <Styled.BuilderForm
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Styled.SelectedPet>
            <PetPreview petId={avatarId} size={92} />
            <div>
              <span>{selectedPet.species === "dog" ? "DOG" : "CAT"}</span>
              <strong>{selectedPet.name}</strong>
              <small>{selectedPet.breed}</small>
            </div>
          </Styled.SelectedPet>
          <Field>
            <label>이름</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 프론트엔드 개발자"
              required
            />
          </Field>
          <Field>
            <label>어떤 도움을 주나요?</label>
            <TextArea
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="이 동료가 도와줄 일을 적어 주세요."
              required
            />
          </Field>
          <Fieldset>
            <Legend>스킬 · 선택 사항</Legend>
            <HelperText>
              스킬 없이도 기본 업무를 수행합니다. 반복해서 잘해야 할 전문 업무가 있으면 스킬을
              연결하세요.
            </HelperText>
            <Styled.CheckGrid>
              {(skills.data ?? []).map((skill) => (
                <Styled.CheckChip
                  key={skill.id}
                  title={
                    (skill.requiredPermissions ?? []).length > 0
                      ? `필요 권한: ${(skill.requiredPermissions ?? []).map((permission) => PERMISSIONS.find((item) => item.key === permission)?.label ?? permission).join(", ")}`
                      : undefined
                  }
                >
                  <Input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleSkill(skill)}
                  />
                  <span>{skill.name}</span>
                </Styled.CheckChip>
              ))}
              {skills.data?.length === 0 && (
                <Empty>스킬 없이 바로 만들 수 있습니다. 나중에 스킬 작업실에서 추가하세요.</Empty>
              )}
            </Styled.CheckGrid>
            {mappedSkillPermissions.length > 0 && (
              <Styled.MappedPermissions>
                <strong>자동으로 적용될 권한</strong>
                <div>
                  {mappedSkillPermissions.map((permission) => (
                    <span key={permission}>
                      {PERMISSIONS.find((item) => item.key === permission)?.label ?? permission}
                    </span>
                  ))}
                </div>
              </Styled.MappedPermissions>
            )}
          </Fieldset>
          <Styled.AdvancedOptions>
            <summary>고급 설정 · 실행 엔진과 모델</summary>
            <div>
              <Field>
                <label>실행 엔진</label>
                <Styled.EnginePicker>
                  <button
                    type="button"
                    className={model === "codex" ? "selected" : ""}
                    onClick={() => {
                      setModel("codex");
                      setModelName(defaultManualModel("codex"));
                    }}
                  >
                    Codex <small>로컬 CLI</small>
                  </button>
                  <button
                    type="button"
                    className={model === "claude" ? "selected" : ""}
                    onClick={() => {
                      setModel("claude");
                      setModelName(defaultManualModel("claude"));
                    }}
                  >
                    Claude <small>로컬 CLI</small>
                  </button>
                </Styled.EnginePicker>
              </Field>
              <ModelPolicyFields
                runtime={model}
                policy={modelPolicy}
                modelName={modelName}
                reasoningEffort={reasoningEffort}
                onPolicyChange={setModelPolicy}
                onModelNameChange={setModelName}
                onReasoningEffortChange={setReasoningEffort}
              />
              <>
                <ProjectDirectorySelect
                  workspaceId={workspace.id}
                  value={workingDirectory}
                  onChange={setWorkingDirectory}
                  label="기본 실행 폴더"
                  emptyLabel="워크스페이스 기본값"
                />
                <Fieldset>
                  <Legend>도구 권한</Legend>
                  <Styled.CheckGrid>
                    {PERMISSIONS.map(({ key, label }) => {
                      const required = key === "fileRead" || key === "terminal";
                      return (
                        <Styled.CheckChip key={key}>
                          <Input
                            type="checkbox"
                            checked={permissions[key] ?? false}
                            disabled={required}
                            onChange={(event) =>
                              setPermissions({ ...permissions, [key]: event.target.checked })
                            }
                          />
                          <span>
                            {label}
                            {required ? " · 자동 적용" : key === "figma" ? " · 연결 필요" : ""}
                          </span>
                        </Styled.CheckChip>
                      );
                    })}
                  </Styled.CheckGrid>
                </Fieldset>
              </>
            </div>
          </Styled.AdvancedOptions>
          <Button
            $variant="primary"
            $fullWidth
            disabled={mutation.isPending || !name.trim() || !role.trim()}
          >
            에이전트 만들기
          </Button>
          {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
        </Styled.BuilderForm>
        <Styled.AvatarLibrary>
          <SectionHeading>
            <div>
              <Kicker>PET LIBRARY</Kicker>
              <h2>캐릭터 고르기</h2>
            </div>
          </SectionHeading>
          <h3>강아지</h3>
          <Styled.PetGrid>
            {PETS.filter((pet) => pet.species === "dog").map((pet) => (
              <PetChoice
                key={pet.id}
                pet={pet}
                selected={avatarId === pet.id}
                onSelect={setAvatarId}
              />
            ))}
          </Styled.PetGrid>
          <h3>고양이</h3>
          <Styled.PetGrid>
            {PETS.filter((pet) => pet.species === "cat").map((pet) => (
              <PetChoice
                key={pet.id}
                pet={pet}
                selected={avatarId === pet.id}
                onSelect={setAvatarId}
              />
            ))}
          </Styled.PetGrid>
        </Styled.AvatarLibrary>
      </Styled.BuilderLayout>
      <Styled.Roster>
        <SectionHeading $compact>
          <h2>현재 동료</h2>
          <span>{agents.data?.length ?? 0}</span>
        </SectionHeading>
        <Styled.RosterGrid>
          {(agents.data ?? []).map((agent) => (
            <Styled.AgentCard key={agent.id} $selected={selectedAgentId === agent.id}>
              <button type="button" onClick={() => setSelectedAgentId(agent.id)}>
                <PetPreview petId={agent.avatarId ?? ""} size={72} />
                <div>
                  <strong>{agent.name}</strong>
                  <span>{agent.role}</span>
                  <small>
                    {agent.model.toUpperCase()} ·{" "}
                    {agent.skillIds.length > 0 ? `스킬 ${agent.skillIds.length}개` : "기본"}
                  </small>
                </div>
              </button>
              <Styled.AgentCardActions>
                <Link to={`/agents/${agent.id}`} aria-label={`${agent.name} 옵션 수정`}>
                  옵션 수정
                </Link>
                <button
                  type="button"
                  disabled={removeAgent.isPending && removeAgent.variables === agent.id}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `${agent.name} 에이전트를 삭제할까요?`,
                        description: "실행 기록이 있으면 삭제할 수 없습니다.",
                        confirmLabel: "에이전트 삭제",
                        tone: "danger",
                      })
                    )
                      removeAgent.mutate(agent.id);
                  }}
                >
                  삭제
                </button>
              </Styled.AgentCardActions>
            </Styled.AgentCard>
          ))}
          {agents.data?.length === 0 && <Empty>아직 초대한 동료가 없습니다.</Empty>}
        </Styled.RosterGrid>
        {removeAgent.isError && <ErrorBanner>{messageOf(removeAgent.error)}</ErrorBanner>}
      </Styled.Roster>
      {selectedAgent && (
        <Styled.QuickJobs>
          <SectionHeading>
            <div>
              <Kicker>QUICK ASSIGN</Kicker>
              <h2>{selectedAgent.name}에게 바로 맡기기</h2>
            </div>
          </SectionHeading>
          <HelperText>
            자주 하는 일을 등록해 두면 동료를 클릭한 뒤 한 번에 작업을 만들 수 있습니다.
          </HelperText>
          <Styled.QuickJobList>
            {(templates.data ?? []).map((template) => (
              <Styled.QuickJob key={template.id}>
                <button type="button" onClick={() => quickTask.mutate(template)}>
                  <strong>{template.title}</strong>
                  <span>{template.description || "설명 없이 바로 작업 만들기"}</span>
                </button>
                <Styled.RemoveQuickJobButton
                  type="button"
                  aria-label="등록 작업 삭제"
                  title="등록 작업 삭제"
                  onClick={() => removeTemplate.mutate(template.id)}
                >
                  <TrashIcon size={14} />
                </Styled.RemoveQuickJobButton>
              </Styled.QuickJob>
            ))}
            {templates.data?.length === 0 && (
              <Empty>등록된 작업이 없습니다. 아래에서 첫 작업을 추가해 보세요.</Empty>
            )}
          </Styled.QuickJobList>
          {recentJobs.length > 0 && (
            <Styled.RecentJobs>
              <strong>최근 맡긴 작업</strong>
              {recentJobs.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() =>
                    quickTask.mutate({
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                    })
                  }
                >
                  {task.title}
                </button>
              ))}
            </Styled.RecentJobs>
          )}
          <Styled.QuickJobForm
            onSubmit={(event) => {
              event.preventDefault();
              saveTemplate.mutate();
            }}
          >
            <Field>
              <label>작업 이름</label>
              <Input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="예: UI 검토"
                required
              />
            </Field>
            <Field $grow>
              <label>기본 요청</label>
              <Input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="예: Figma 화면의 사용성과 일관성을 검토해 줘"
              />
            </Field>
            <Button $variant="secondary" disabled={saveTemplate.isPending || !templateTitle.trim()}>
              등록
            </Button>
          </Styled.QuickJobForm>
          {(quickTask.isError || saveTemplate.isError) && (
            <ErrorBanner>{messageOf(quickTask.error ?? saveTemplate.error)}</ErrorBanner>
          )}
        </Styled.QuickJobs>
      )}
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}

function PetChoice({
  pet,
  selected,
  onSelect,
}: {
  pet: (typeof PETS)[number];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Styled.PetChoice
      type="button"
      $selected={selected}
      onClick={() => onSelect(pet.id)}
      title={`${pet.breed} · ${pet.accessories.join(", ")}`}
    >
      <PetPreview petId={pet.id} size={54} />
      <strong>{pet.name}</strong>
      <span>{pet.breed}</span>
    </Styled.PetChoice>
  );
}

export function AgentDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const agentQuery = useQuery({ queryKey: ["agent", id], queryFn: () => agentApi.get(id) });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const templates = useQuery({
    queryKey: ["agent-task-templates", id],
    queryFn: () => agentApi.listTaskTemplates(id),
    enabled: Boolean(id),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState<"codex" | "claude">("codex");
  const [modelPolicy, setModelPolicy] = useState<ModelPolicy>("default");
  const [modelName, setModelName] = useState(defaultManualModel("codex"));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [avatarId, setAvatarId] = useState(PETS[0]!.id);
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<AgentPermissions>({});
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  useEffect(() => {
    const agent = agentQuery.data;
    if (!agent) return;
    setName(agent.name);
    setRole(agent.role);
    setDescription(agent.description ?? "");
    setModel(agent.model);
    setModelPolicy(agent.modelPolicy ?? "default");
    setModelName(agent.modelName ?? defaultManualModel(agent.model));
    setReasoningEffort(agent.reasoningEffort ?? "medium");
    setAvatarId(agent.avatarId ?? PETS[0]!.id);
    setWorkingDirectory(agent.workingDirectory ?? "");
    setSelectedSkills(agent.skillIds);
    setPermissions({
      ...agent.permissions,
      fileRead: true,
      fileWrite: agent.mode === "chat" ? true : agent.permissions.fileWrite,
      terminal: true,
    });
  }, [agentQuery.data]);
  const save = useMutation({
    mutationFn: () =>
      agentApi.update(id, {
        name,
        role,
        description,
        model,
        modelPolicy,
        modelName: modelPolicy === "manual" ? modelName : "",
        reasoningEffort: modelPolicy === "manual" ? reasoningEffort : undefined,
        mode: "worker",
        avatarId,
        workingDirectory,
        skillIds: selectedSkills,
        permissions: { ...permissions, fileRead: true, terminal: true },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent", id] });
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
    },
  });
  const remove = useMutation({
    mutationFn: () => agentApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      navigate("/agents");
    },
  });
  const addTemplate = useMutation({
    mutationFn: () =>
      agentApi.createTaskTemplate(id, {
        title: templateTitle,
        description: templateDescription || undefined,
      }),
    onSuccess: () => {
      setTemplateTitle("");
      setTemplateDescription("");
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", id] });
    },
  });
  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) => agentApi.deleteTaskTemplate(id, templateId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", id] }),
  });
  if (agentQuery.isPending)
    return (
      <BaseLayout>
        <Empty>에이전트 정보를 불러오는 중...</Empty>
      </BaseLayout>
    );
  if (agentQuery.isError || !agentQuery.data)
    return (
      <BaseLayout>
        <ErrorBanner>{messageOf(agentQuery.error)}</ErrorBanner>
      </BaseLayout>
    );
  const agentTasks = (tasks.data ?? []).filter((task) => task.assigneeAgentId === id);
  const toggleAgentSkill = (skill: Skill) => {
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
  return (
    <BaseLayout>
      <BackButton onClick={() => navigate("/agents")}>← 에이전트 목록</BackButton>
      <PageHeader eyebrow="AGENT PROFILE" title={agentQuery.data.name} />
      <Styled.DetailGrid>
        <Styled.BuilderForm
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Styled.SelectedPet>
            <PetPreview petId={avatarId} size={92} />
            <div>
              <span>{model.toUpperCase()}</span>
              <strong>{name || "이름 없음"}</strong>
              <small>
                {selectedSkills.length > 0 ? `스킬 ${selectedSkills.length}개` : "기본 업무"}
              </small>
            </div>
          </Styled.SelectedPet>
          <Field>
            <label>캐릭터</label>
            <Select value={avatarId} onChange={(event) => setAvatarId(event.target.value)}>
              {PETS.map((pet) => (
                <option value={pet.id} key={pet.id}>
                  {pet.name} · {pet.breed}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <label>이름</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field>
            <label>역할</label>
            <TextArea value={role} onChange={(event) => setRole(event.target.value)} required />
          </Field>
          <Field>
            <label>설명</label>
            <TextArea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Fieldset>
            <Legend>스킬 · 선택 사항</Legend>
            <HelperText>
              스킬은 선택 사항이며, 연결한 스킬에 필요한 권한은 자동으로 적용됩니다.
            </HelperText>
            <Styled.CheckGrid>
              {(skills.data ?? []).map((skill) => (
                <Styled.CheckChip key={skill.id}>
                  <Input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleAgentSkill(skill)}
                  />
                  <span>{skill.name}</span>
                </Styled.CheckChip>
              ))}
              {skills.data?.length === 0 && (
                <Empty>등록된 스킬이 없습니다. 스킬 없이도 기본 업무를 수행할 수 있습니다.</Empty>
              )}
            </Styled.CheckGrid>
          </Fieldset>
          <Styled.AdvancedOptions>
            <summary>고급 설정 · 실행 엔진과 모델</summary>
            <div>
              <Field>
                <label>실행 엔진</label>
                <Styled.EnginePicker>
                  <button
                    type="button"
                    className={model === "codex" ? "selected" : ""}
                    onClick={() => {
                      setModel("codex");
                      setModelName(defaultManualModel("codex"));
                    }}
                  >
                    Codex
                  </button>
                  <button
                    type="button"
                    className={model === "claude" ? "selected" : ""}
                    onClick={() => {
                      setModel("claude");
                      setModelName(defaultManualModel("claude"));
                    }}
                  >
                    Claude
                  </button>
                </Styled.EnginePicker>
              </Field>
              <ModelPolicyFields
                runtime={model}
                policy={modelPolicy}
                modelName={modelName}
                reasoningEffort={reasoningEffort}
                onPolicyChange={setModelPolicy}
                onModelNameChange={setModelName}
                onReasoningEffortChange={setReasoningEffort}
              />
              <>
                <ProjectDirectorySelect
                  workspaceId={workspace.id}
                  value={workingDirectory}
                  onChange={setWorkingDirectory}
                  label="기본 실행 폴더"
                  emptyLabel="워크스페이스 기본값"
                />
                <Fieldset>
                  <Legend>권한</Legend>
                  <Styled.CheckGrid>
                    {PERMISSIONS.map(({ key, label }) => (
                      <Styled.CheckChip key={key}>
                        <Input
                          type="checkbox"
                          checked={permissions[key] ?? false}
                          disabled={key === "fileRead" || key === "terminal"}
                          onChange={(event) =>
                            setPermissions({ ...permissions, [key]: event.target.checked })
                          }
                        />
                        <span>
                          {label}
                          {key === "fileRead" || key === "terminal" ? " · 자동 적용" : ""}
                        </span>
                      </Styled.CheckChip>
                    ))}
                  </Styled.CheckGrid>
                </Fieldset>
              </>
            </div>
          </Styled.AdvancedOptions>
          <Button
            $variant="primary"
            $fullWidth
            disabled={save.isPending || !name.trim() || !role.trim()}
          >
            변경 저장
          </Button>
          <Button
            type="button"
            $variant="danger"
            $fullWidth
            disabled={remove.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: "이 에이전트를 삭제할까요?",
                  description: "실행 기록이 있으면 삭제할 수 없습니다.",
                  confirmLabel: "에이전트 삭제",
                  tone: "danger",
                })
              )
                remove.mutate();
            }}
          >
            에이전트 삭제
          </Button>
          {(save.isError || remove.isError) && (
            <ErrorBanner>{messageOf(save.error ?? remove.error)}</ErrorBanner>
          )}
        </Styled.BuilderForm>
        <Styled.DetailSide>
          <Styled.ProfileStats>
            <div>
              <strong>{agentTasks.length}</strong>
              <span>전체 작업</span>
            </div>
            <div>
              <strong>{agentTasks.filter((task) => task.status === "done").length}</strong>
              <span>완료</span>
            </div>
            <div>
              <strong>{agentTasks.filter((task) => task.status === "failed").length}</strong>
              <span>실패</span>
            </div>
          </Styled.ProfileStats>
          <Styled.ProfilePanel>
            <SectionHeading $compact>
              <h2>자주 맡기는 작업</h2>
              <span>{templates.data?.length ?? 0}</span>
            </SectionHeading>
            <Styled.TemplateList>
              {(templates.data ?? []).map((template) => (
                <div key={template.id}>
                  <div>
                    <strong>{template.title}</strong>
                    <span>{template.description || "설명 없음"}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="등록 작업 삭제"
                    title="등록 작업 삭제"
                    onClick={() => deleteTemplate.mutate(template.id)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
            </Styled.TemplateList>
            <Styled.TemplateForm
              onSubmit={(event) => {
                event.preventDefault();
                addTemplate.mutate();
              }}
            >
              <Input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="예: UI 검토"
                required
              />
              <Input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="기본 요청"
              />
              <Button
                $variant="secondary"
                disabled={!templateTitle.trim() || addTemplate.isPending}
              >
                추가
              </Button>
            </Styled.TemplateForm>
          </Styled.ProfilePanel>
          <Styled.ProfilePanel>
            <SectionHeading $compact>
              <h2>최근 작업</h2>
              <span>{agentTasks.length}</span>
            </SectionHeading>
            <Styled.TaskList>
              {agentTasks.slice(0, 8).map((task) => (
                <Link to={`/tasks/${task.id}`} key={task.id}>
                  <Styled.StatusPill $status={task.status}>
                    {STATUS[task.status].label}
                  </Styled.StatusPill>
                  <strong>{task.title}</strong>
                  <time>{relativeTime(task.updatedAt)}</time>
                </Link>
              ))}
              {agentTasks.length === 0 && <Empty>아직 맡은 작업이 없습니다.</Empty>}
            </Styled.TaskList>
          </Styled.ProfilePanel>
        </Styled.DetailSide>
      </Styled.DetailGrid>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
