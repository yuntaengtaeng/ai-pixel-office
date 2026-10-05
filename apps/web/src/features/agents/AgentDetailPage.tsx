import { mediaQuery } from "@ai-pixel-office/design-system";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  BackButton,
  Button,
  Field,
  HelperText,
  Input,
  Panel,
  Select,
  TextArea,
  TrashIcon,
} from "@ai-pixel-office/design-system";
import type { AgentModel, Task, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi } from "../tasks/api.ts";
import { skillApi } from "../skills/api.ts";
import { agentApi } from "./api.ts";
import { PETS } from "@ai-pixel-office/pet";
import { PetPreview } from "../office/PetPreview.tsx";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { TaskStatusPill } from "../tasks/components/TaskStatusPill.tsx";
import { petUnlockApi } from "./pet-unlocks-api.ts";
import { useAgentForm } from "./hooks/useAgentForm.ts";
import { AgentSkillsField } from "./components/AgentSkillsField.tsx";
import { AgentAdvancedOptions } from "./components/AgentAdvancedOptions.tsx";
import { systemApi } from "../system/api.ts";

const Styled = {
  SubmitButton: styled(Button)`
    margin-top: auto;
  `,
  Roster: styled(Panel).attrs({ as: "section" })`
    margin-top: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x5};
  `,
  RosterGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: ${({ theme }) => theme.space.x3};

    @media ${mediaQuery.xl} {
      grid-template-columns: repeat(2, 1fr);
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  AgentCard: styled.article`
    position: relative;
    width: 100%;
    padding: 0;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    text-align: left;

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.shadow.positive};
    }

    > button {
      width: 100%;
      padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3} ${theme.space.x11}`};
      border: 0;
      background: transparent;
      display: flex;
      gap: ${({ theme }) => theme.space.x3};
      align-items: center;
      text-align: left;
      cursor: pointer;
    }

    div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
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
    gap: ${({ theme }) => theme.space.x1} !important;

    a,
    button {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
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
  RecentJobs: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x3};
    flex-wrap: wrap;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.muted};

    button {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      cursor: pointer;
    }
  `,
  DetailGrid: styled.div`
    display: grid;
    grid-template-columns: minmax(310px, 0.85fr) minmax(0, 1.15fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  DetailSide: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  ProfileStats: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.space.x2};

    div {
      padding: ${({ theme }) => theme.space.x3};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      text-align: center;
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
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
    gap: ${({ theme }) => theme.space.x2};

    > div {
      display: grid;
      grid-template-columns: 1fr 30px;
      border: 1px solid ${({ theme }) => theme.colors.border.subtle};

      > button:first-child {
        min-width: 0;
        padding: ${({ theme }) => theme.space.x2};
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        display: grid;
        gap: ${({ theme }) => theme.space.x1};
      }

      > button:last-child {
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
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `,
  TemplateForm: styled.form`
    display: grid;
    grid-template-columns: 0.7fr 1fr auto;
    align-items: end;
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x3};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  TaskList: styled.div`
    display: grid;

    > a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: ${({ theme }) => theme.space.x2};
      align-items: center;
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x1}`};
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
    grid-template-columns: minmax(360px, 1.1fr) minmax(320px, 0.9fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: stretch;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  BuilderForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x6};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.space.x5};

    h2 {
      margin: 0;
    }
  `,
  SelectedPet: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x4};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.default};

    div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};

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
  IntroText: styled(HelperText)`
    margin-bottom: ${({ theme }) => theme.space.x2};
  `,
  AvatarLibrary: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x6};

    h3 {
      margin: ${({ theme }) => `${theme.space.x5} 0 ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
  PetGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      grid-template-columns: repeat(3, 1fr);
    }
  `,
};

const RECENT_JOB_LIMIT = 3;

function recentDistinctTasks(tasks: Task[], limit: number): Task[] {
  return Array.from(new Map(tasks.map((task) => [task.title, task])).values()).slice(0, limit);
}

export function AgentDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const agentQuery = useQuery({ queryKey: ["agent", id], queryFn: () => agentApi.get(id) });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const petUnlocks = useQuery({
    queryKey: ["pet-unlocks", workspace.id],
    queryFn: () => petUnlockApi.progress(workspace.id),
  });
  const runtimeStatus = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    refetchOnWindowFocus: false,
  });
  const templates = useQuery({
    queryKey: ["agent-task-templates", id],
    queryFn: () => agentApi.listTaskTemplates(id),
    enabled: Boolean(id),
  });
  const {
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
    permissions,
    setPermissions,
    toggleSkill: toggleAgentSkill,
  } = useAgentForm(agentQuery.data);
  const availableModels = (["codex", "claude"] as const).filter(
    (runtime) => runtimeStatus.data?.[runtime].authenticated || runtime === model,
  ) satisfies AgentModel[];
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
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
  const quickTask = useMutation({
    mutationFn: (input: { title: string; description?: string }) =>
      taskApi.create({ ...input, workspaceId: workspace.id, assigneeAgentId: id }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
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
  const recentJobs = recentDistinctTasks(agentTasks, RECENT_JOB_LIMIT);
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
                <option
                  value={pet.id}
                  key={pet.id}
                  disabled={
                    pet.id !== avatarId &&
                    pet.unlock !== undefined &&
                    petUnlocks.data?.some(
                      (unlock) => unlock.petId === pet.id && unlock.unlocked,
                    ) !== true
                  }
                >
                  {pet.name} · {pet.unlock && pet.id !== avatarId ? "미지의 동료" : pet.breed}
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
          <AgentSkillsField
            skills={skills.data ?? []}
            selectedSkills={selectedSkills}
            onToggleSkill={toggleAgentSkill}
          />
          <AgentAdvancedOptions
            model={model}
            setModel={setModel}
            modelPolicy={modelPolicy}
            setModelPolicy={setModelPolicy}
            modelName={modelName}
            setModelName={setModelName}
            reasoningEffort={reasoningEffort}
            setReasoningEffort={setReasoningEffort}
            permissions={permissions}
            setPermissions={setPermissions}
            availableModels={[...availableModels]}
          />
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
            <Styled.IntroText>등록해 둔 작업을 클릭하면 바로 작업이 만들어져요.</Styled.IntroText>
            <Styled.TemplateList>
              {(templates.data ?? []).map((template) => (
                <div key={template.id}>
                  <button type="button" onClick={() => quickTask.mutate(template)}>
                    <strong>{template.title}</strong>
                    <span>{template.description || "설명 없이 바로 작업 만들기"}</span>
                  </button>
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
            {recentJobs.length > 0 && (
              <Styled.RecentJobs>
                <strong>최근 맡긴 작업</strong>
                {recentJobs.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() =>
                      quickTask.mutate({ title: task.title, description: task.description })
                    }
                  >
                    {task.title}
                  </button>
                ))}
              </Styled.RecentJobs>
            )}
            {quickTask.isError && <ErrorBanner>{messageOf(quickTask.error)}</ErrorBanner>}
            <Styled.TemplateForm
              onSubmit={(event) => {
                event.preventDefault();
                addTemplate.mutate();
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
              <Field>
                <label>기본 요청</label>
                <Input
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="선택 사항"
                />
              </Field>
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
                  <TaskStatusPill task={task} />
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
