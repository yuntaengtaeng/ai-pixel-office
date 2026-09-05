import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BackButton, Button, Input, Select, TextArea } from "@ai-pixel-office/design-system";
import type { KnowledgeDocument, Workspace } from "@ai-pixel-office/domain/entities";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { skillApi } from "../skills/api.ts";
import { workflowApi } from "../workflows/api.ts";
import { taskApi } from "./api.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { TechnicalDetails } from "../../shared/ui/TechnicalDetails.tsx";
import { ProjectSelect } from "../projects/ProjectSelect.tsx";
import { recordApi } from "../records/api.ts";
import { TaskResultView } from "./components/results/TaskResultView.tsx";
import { WorkInProgress } from "./components/execution/WorkInProgress.tsx";
import { RunProgress } from "./components/execution/RunProgress.tsx";
import { FailureState as ExecutionFailureState } from "./components/execution/FailureState.tsx";
import { SessionLimitState as ExecutionSessionLimitState } from "./components/execution/SessionLimitState.tsx";
import { sessionLimitFrom as parseSessionLimit } from "./utils/sessionLimit.ts";
import { RuntimeApproval as ExecutionRuntimeApproval } from "./components/execution/RuntimeApproval.tsx";
import { WorkflowPanel } from "./components/assignment/WorkflowPanel.tsx";
import { CurrentRunRequest } from "./components/execution/CurrentRunRequest.tsx";
import { PreviousResult } from "./components/results/PreviousResult.tsx";
import { ExecutionContextPanel } from "./components/context/ExecutionContextPanel.tsx";
import { RunHistory } from "./components/results/RunHistory.tsx";
import { WorkflowResults } from "./components/results/WorkflowResults.tsx";

import * as DS from "@ai-pixel-office/design-system";
import styled, { keyframes } from "styled-components";
import type { TaskStatus } from "@ai-pixel-office/domain/entities";

const pixelWork = keyframes`
  from {
    height: 8px;
    opacity: 0.45;
  }
  to {
    height: 31px;
    opacity: 1;
  }
`;

const Styled = {
  Heading: styled.div`
    margin: ${({ theme }) => `${theme.space.x6} 0 ${theme.space.x7}`};

    h1 {
      margin: ${({ theme }) => `${theme.space.x1} 0 0`};
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: clamp(29px, 4vw, 42px);
      letter-spacing: -0.045em;
    }

    p {
      color: ${({ theme }) => theme.colors.text.muted};
      max-width: 720px;
    }
  `,
  StatusPill: styled.span<{ $status: TaskStatus }>`
    display: inline-block;
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
    border: 2px solid currentColor;
    border-top-color: ${({ $status }) => STATUS[$status].color};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  `,
  PrimaryActionBar: styled.div`
    position: sticky;
    top: ${({ theme }) => theme.space.x3};
    z-index: ${({ theme }) => theme.zIndex.navigation};
    margin: ${({ theme }) => `-${theme.space.x4} 0 ${theme.space.x5}`};
    padding: ${({ theme }) => theme.space.x3};
    border: 2px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
  `,
  Organizing: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    color: ${({ theme }) => theme.colors.text.positive} !important;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};

    b {
      display: inline-block;
      animation: ${pixelWork} 0.55s ease-in-out infinite alternate;
    }
  `,
  DetailLayout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.65fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${DS.mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  DetailMain: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x5};
  `,
  ResultPanel: styled(DS.Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
    min-height: 340px;
  `,
  ReviewBox: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    margin-top: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x4};
    border: 2px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.border.positive};
  `,
  ReviewCopy: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.5;
    }
  `,
  ReviewFollowup: styled.form`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x2};

    input {
      min-width: 0;
    }

    @media ${DS.mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ReviewFinish: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    padding-top: ${({ theme }) => theme.space.x3};
    border-top: 1px solid ${({ theme }) => theme.colors.border.positive};

    span {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }

    @media ${DS.mediaQuery.md} {
      align-items: flex-start;
    }
  `,
  DetailAgent: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.space.x3};
    align-items: center;
    padding-bottom: ${({ theme }) => theme.space.x4};
    border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};

    div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    small {
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      color: ${({ theme }) => theme.colors.text.positive};
    }
  `,
  AgentSkillList: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space.x1};
    margin-top: ${({ theme }) => theme.space.x1};

    span {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x1}`};
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  ReferenceDocuments: styled.div`
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    > div {
      display: flex;
      justify-content: space-between;
      gap: ${({ theme }) => theme.space.x2};
    }

    small {
      color: ${({ theme }) => theme.colors.text.muted};
    }
    a {
      color: ${({ theme }) => theme.colors.text.positive};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
    > details > summary {
      cursor: pointer;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
    > details > div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      margin-top: ${({ theme }) => theme.space.x2};
    }
    > details button {
      display: flex;
      justify-content: space-between;
      padding: ${({ theme }) => theme.space.x2};
      border: 1px solid ${({ theme }) => theme.colors.border.subtle};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      cursor: pointer;
    }
  `,
  PermissionWarning: styled.div`
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => theme.space.x3};
    border: 2px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    strong {
      color: ${({ theme }) => theme.colors.text.negative};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.5;
    }
  `,
  TaskMeta: styled(DS.Panel).attrs({ as: "aside" })`
    padding: ${({ theme }) => theme.space.x5};

    > h2 {
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
      margin: ${({ theme }) => `0 0 ${theme.space.x3}`};
    }

    dl {
      margin: ${({ theme }) => `${theme.space.x4} 0`};
      display: grid;
      gap: ${({ theme }) => theme.space.x2};

      div {
        display: flex;
        justify-content: space-between;
        font-size: ${({ theme }) => theme.typography.fontSize.compact};
      }

      dt {
        color: ${({ theme }) => theme.colors.text.muted};
      }

      dd {
        margin: 0;
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
        text-align: right;
      }
    }
  `,
  TaskDangerZone: styled.div`
    margin-top: ${({ theme }) => theme.space.x4};
    padding-top: ${({ theme }) => theme.space.x4};
    border-top: 2px dashed ${({ theme }) => theme.colors.border.negative};
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x3};
    align-items: center;

    > div {
      min-width: 0;
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
    }

    strong {
      color: ${({ theme }) => theme.colors.text.negative};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    span {
      color: ${({ theme }) => theme.colors.text.negative};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      line-height: 1.4;
    }

    @media ${DS.mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  TaskRemoveButton: styled(DS.Button).attrs({ $variant: "danger" as const })`
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    white-space: nowrap;

    @media ${DS.mediaQuery.md} {
      width: 100%;
    }
  `,
  AssignmentPanel: styled.div`
    margin-bottom: ${({ theme }) => theme.space.x4};
    padding: ${({ theme }) => theme.space.x3};
    border: 2px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      line-height: 1.5;
    }
  `,
  AssignmentLink: styled(DS.Button).attrs({ $variant: "secondary" as const })`
    display: inline-block;
    width: fit-content;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  `,
  TaskBriefEditor: styled.div`
    margin-top: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    label {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      line-height: 1.55;
    }

    textarea {
      width: 100%;
      min-height: 180px;
      resize: vertical;
      line-height: 1.55;
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
    }
  `,
  TaskBriefActions: styled.div`
    margin-top: ${({ theme }) => theme.space.x1};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};

    small {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      line-height: 1.55;
    }

    @media ${DS.mediaQuery.md} {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
};

export function TaskDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const task = useQuery({
    queryKey: ["task", id],
    queryFn: () => taskApi.get(id),
    refetchInterval: (query) =>
      ["working", "needs_input"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });
  const executionContexts = useQuery({
    queryKey: ["task-execution-context", id],
    queryFn: () => taskApi.executionContexts(id),
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const activities = useQuery({
    queryKey: ["activities", workspace.id],
    queryFn: () => activityApi.list(workspace.id),
  });
  const workflowPresets = useQuery({
    queryKey: ["workflow-presets", workspace.id],
    queryFn: () => workflowApi.listPresets(workspace.id),
  });
  const knowledgeDocuments = useQuery({
    queryKey: ["knowledge-documents", workspace.id],
    queryFn: () => recordApi.list(workspace.id),
  });
  const [feedback, setFeedback] = useState("");
  const [taskBrief, setTaskBrief] = useState("");
  useEffect(() => {
    if (task.data?.status === "todo") setTaskBrief(task.data.description ?? "");
  }, [task.data?.description, task.data?.id, task.data?.status]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["task", id] });
    void queryClient.invalidateQueries({ queryKey: ["task-execution-context", id] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
  };
  const run = useMutation({
    mutationFn: async () => {
      const description = taskBrief.trim();
      if (description !== (task.data?.description ?? "").trim()) {
        await taskApi.update(id, { description });
      }
      return taskApi.run(id);
    },
    onSuccess: refresh,
  });
  const retry = useMutation({ mutationFn: () => taskApi.retry(id), onSuccess: refresh });
  const continueSession = useMutation({
    mutationFn: () => taskApi.continue(id),
    onSuccess: refresh,
  });
  const extendSession = useMutation({
    mutationFn: () => taskApi.extendSession(id),
    onSuccess: refresh,
  });
  const approve = useMutation({ mutationFn: () => taskApi.approve(id), onSuccess: refresh });
  const changes = useMutation({
    mutationFn: () => taskApi.requestChanges(id, feedback),
    onSuccess: () => {
      setFeedback("");
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (runId: string) => taskApi.cancelRun(runId),
    onSuccess: refresh,
  });
  const resolveApproval = useMutation({
    mutationFn: ({
      runId,
      requestId,
      decision,
    }: {
      runId: string;
      requestId: string;
      decision: "accept" | "cancel";
    }) => taskApi.resolveApproval(runId, requestId, decision),
    onSuccess: refresh,
  });
  const updateAssignment = useMutation({
    mutationFn: (assigneeAgentId: string) => taskApi.update(id, { assigneeAgentId }),
    onSuccess: refresh,
  });
  const updateBrief = useMutation({
    mutationFn: () => taskApi.update(id, { description: taskBrief.trim() }),
    onSuccess: refresh,
  });
  const updateProject = useMutation({
    mutationFn: (projectId: string) => taskApi.update(id, { projectId }),
    onSuccess: refresh,
  });
  const updateWorkflow = useMutation({
    mutationFn: (agentIds: string[]) => workflowApi.setTaskWorkflow(id, agentIds),
    onSuccess: refresh,
  });
  const createWorkflowPreset = useMutation({
    mutationFn: ({ name, agentIds }: { name: string; agentIds: string[] }) =>
      workflowApi.createPreset({ workspaceId: workspace.id, name, agentIds }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["workflow-presets", workspace.id] }),
  });
  const deleteWorkflowPreset = useMutation({
    mutationFn: (presetId: string) => workflowApi.deletePreset(presetId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["workflow-presets", workspace.id] }),
  });
  const remove = useMutation({
    mutationFn: () => taskApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate("/");
    },
  });
  const item = task.data;
  const agent = agents.data?.find((entry) => entry.id === item?.assigneeAgentId);
  const missingRuntimePermissions = Boolean(
    agent &&
    (agent.mode === "chat" ||
      agent.permissions.fileRead !== true ||
      agent.permissions.terminal !== true),
  );
  const agentSkills = (skills.data ?? []).filter((skill) => agent?.skillIds.includes(skill.id));
  const referenceDocuments = (knowledgeDocuments.data ?? []).filter(
    (document) => document.taskId === item?.id,
  );
  const createRecord = useMutation({
    mutationFn: () => taskApi.createDocument(item!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents", workspace.id] });
      navigate("/records");
    },
  });
  const toggleReferenceDocument = useMutation({
    mutationFn: (document: KnowledgeDocument) => {
      const isReferenced = document.referenceTaskIds.includes(item!.id);
      const referenceTaskIds = isReferenced
        ? document.referenceTaskIds.filter((taskId) => taskId !== item!.id)
        : [...document.referenceTaskIds, item!.id];
      return recordApi.update(workspace.id, document.id, { referenceTaskIds });
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents", workspace.id] }),
  });
  const repairPermissions = useMutation({
    mutationFn: () =>
      agentApi.update(agent!.id, {
        mode: "worker",
        permissions: {
          ...agent!.permissions,
          fileRead: true,
          fileWrite: true,
          terminal: true,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["agent", agent?.id] });
    },
  });
  const latestRun = item?.runs[0];
  const runActivities = (activities.data ?? []).filter(
    (activity) => activity.runId === latestRun?.id,
  );
  const pendingApproval =
    latestRun?.status === "waiting"
      ? runActivities.find((activity) => {
          if (activity.type !== "approval_requested") return false;
          const requestId = String(activity.metadata?.requestId ?? "");
          return !runActivities.some(
            (candidate) =>
              candidate.type === "approval_resolved" &&
              String(candidate.metadata?.requestId ?? "") === requestId &&
              candidate.createdAt > activity.createdAt,
          );
        })
      : undefined;
  const actionError =
    createRecord.error ??
    toggleReferenceDocument.error ??
    run.error ??
    retry.error ??
    extendSession.error ??
    continueSession.error ??
    approve.error ??
    changes.error ??
    cancel.error ??
    resolveApproval.error ??
    repairPermissions.error ??
    updateBrief.error ??
    updateAssignment.error ??
    updateProject.error ??
    updateWorkflow.error ??
    createWorkflowPreset.error ??
    deleteWorkflowPreset.error ??
    remove.error;
  if (task.isPending) return <FullScreenMessage>작업을 불러오는 중...</FullScreenMessage>;
  if (!item || task.isError)
    return <FullScreenMessage error>{messageOf(task.error)}</FullScreenMessage>;
  const sessionLimitReason = parseSessionLimit(latestRun?.error);
  const active = ["working", "needs_input"].includes(item.status);
  return (
    <BaseLayout>
      <BackButton onClick={() => navigate(-1)}>← 작업 목록</BackButton>
      <Styled.Heading>
        <Styled.StatusPill $status={item.status}>{STATUS[item.status].label}</Styled.StatusPill>
        <h1>{item.title}</h1>
        <p>
          {item.status === "todo"
            ? "담당자와 요청 내용을 확인한 뒤 작업을 시작하세요."
            : item.description || "추가 설명이 없습니다."}
        </p>
      </Styled.Heading>
      <Styled.PrimaryActionBar>
        {createRecord.isPending ? (
          <Styled.Organizing>
            <b aria-hidden="true">▦</b> {agent?.name ?? "AI"}가 기록을 주섬주섬 정리하고 있어요.
          </Styled.Organizing>
        ) : (
          <span>
            {item.status === "todo"
              ? agent
                ? "요청을 확인했다면 바로 시작할 수 있어요."
                : "담당자를 선택하면 작업을 시작할 수 있어요."
              : "현재 작업의 요청과 결과를 Markdown 문서로 남길 수 있어요."}
          </span>
        )}
        {item.status === "todo" ? (
          <Button
            $variant="primary"
            disabled={!agent || missingRuntimePermissions || run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending ? "시작하는 중…" : "▶ 작업 시작"}
          </Button>
        ) : (
          <Button
            $variant="secondary"
            disabled={createRecord.isPending}
            onClick={() => createRecord.mutate()}
          >
            {createRecord.isPending
              ? `${agent?.name ?? "AI"}가 문서 작성 중…`
              : "▤ AI로 문서 만들기"}
          </Button>
        )}
      </Styled.PrimaryActionBar>
      <Styled.DetailLayout>
        <Styled.DetailMain>
          <Styled.ResultPanel>
            <SectionHeading $compact>
              <h2>
                {item.status === "todo"
                  ? "작업 요청"
                  : item.workflow.length > 0
                    ? "협업 결과"
                    : "작업 결과"}
              </h2>
              <span>
                {item.status === "todo"
                  ? "BEFORE START"
                  : item.workflow.length > 0
                    ? `${item.workflow.filter((step) => step.result).length}/${item.workflow.length} STEPS`
                    : item.result
                      ? "RESULT"
                      : "WAITING"}
              </span>
            </SectionHeading>
            {active && latestRun?.request && <CurrentRunRequest request={latestRun.request} />}
            {item.status === "todo" ? (
              <Styled.TaskBriefEditor>
                <label htmlFor="task-brief">에이전트에게 전달할 내용</label>
                <p>
                  배경, 원하는 결과, 지켜야 할 조건을 적어 주세요. 제목과 함께 첫 요청으로
                  전달됩니다.
                </p>
                <TextArea
                  id="task-brief"
                  value={taskBrief}
                  onChange={(event) => setTaskBrief(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      agent &&
                      !missingRuntimePermissions &&
                      !run.isPending
                    ) {
                      event.preventDefault();
                      run.mutate();
                    }
                  }}
                  placeholder="예: 현재 UI 구조를 먼저 확인하고, 기존 컴포넌트 스타일을 유지하면서 개선해 주세요."
                  rows={8}
                />
                <Styled.TaskBriefActions>
                  <small>Enter로 바로 시작 · Shift+Enter로 줄바꿈</small>
                  <Button
                    type="button"
                    $variant="secondary"
                    disabled={
                      updateBrief.isPending || taskBrief.trim() === (item.description ?? "").trim()
                    }
                    onClick={() => updateBrief.mutate()}
                  >
                    {updateBrief.isPending ? "저장 중…" : "요청 저장"}
                  </Button>
                </Styled.TaskBriefActions>
              </Styled.TaskBriefEditor>
            ) : sessionLimitReason ? (
              <ExecutionSessionLimitState
                reason={sessionLimitReason}
                canExtend={Boolean(latestRun?.runtimeThreadId)}
                extendPending={extendSession.isPending}
                newSessionPending={continueSession.isPending}
                onExtend={() => extendSession.mutate()}
                onNewSession={() => continueSession.mutate()}
              />
            ) : item.workflow.length > 0 ? (
              <WorkflowResults task={item} agents={agents.data ?? []} error={latestRun?.error} />
            ) : active ? (
              <>
                <WorkInProgress waiting={item.status === "needs_input"} />
                <RunProgress events={item.progress} />
                {item.result && <PreviousResult result={item.result} />}
              </>
            ) : item.result ? (
              <TaskResultView result={item.result} />
            ) : item.status === "failed" ? (
              <ExecutionFailureState error={latestRun?.error} />
            ) : (
              <Empty>작업을 시작하면 여기에 결과가 나타납니다.</Empty>
            )}
            {item.status === "needs_review" && (
              <Styled.ReviewBox>
                <Styled.ReviewCopy>
                  <strong>이어서 요청할 내용이 있나요?</strong>
                  <p>같은 작업 흐름에서 추가 요청을 바로 전달할 수 있어요.</p>
                </Styled.ReviewCopy>
                <Styled.ReviewFollowup
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (feedback.trim() && !changes.isPending) changes.mutate();
                  }}
                >
                  <Input
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="추가로 요청할 내용을 입력하세요."
                  />
                  <Button
                    type="submit"
                    $variant="primary"
                    disabled={!feedback.trim() || changes.isPending}
                  >
                    이어서 요청
                  </Button>
                </Styled.ReviewFollowup>
                <Styled.ReviewFinish>
                  <span>결과가 충분하다면 이 작업을 마무리하세요.</span>
                  <Button
                    $variant="secondary"
                    onClick={() => approve.mutate()}
                    disabled={approve.isPending}
                  >
                    세션 종료
                  </Button>
                </Styled.ReviewFinish>
              </Styled.ReviewBox>
            )}
            {actionError && <ErrorBanner>{messageOf(actionError)}</ErrorBanner>}
          </Styled.ResultPanel>
          <RunHistory runs={item.runs} progressByRun={item.progressByRun} />
        </Styled.DetailMain>
        <Styled.TaskMeta>
          <WorkflowPanel
            task={item}
            agents={agents.data ?? []}
            saving={updateWorkflow.isPending}
            onSave={(agentIds) => updateWorkflow.mutate(agentIds)}
            presets={workflowPresets.data ?? []}
            presetSaving={createWorkflowPreset.isPending || deleteWorkflowPreset.isPending}
            onCreatePreset={(name, agentIds) => createWorkflowPreset.mutate({ name, agentIds })}
            onDeletePreset={async (preset) => {
              if (
                await confirm({
                  title: "협업 그룹을 삭제할까요?",
                  description: `'${preset.name}' 그룹만 삭제되며 Task에 이미 설정된 순서는 유지됩니다.`,
                  confirmLabel: "그룹 삭제",
                  tone: "danger",
                })
              ) {
                deleteWorkflowPreset.mutate(preset.id);
              }
            }}
            singleAssignment={
              item.status === "todo" ? (
                <Styled.AssignmentPanel>
                  <strong>
                    {agent ? "담당자를 변경할 수 있어요" : "먼저 담당자를 배치해 주세요"}
                  </strong>
                  <span>
                    {agent
                      ? "작업을 시작하기 전까지 변경할 수 있습니다."
                      : "작업에 맞는 에이전트를 선택하면 시작할 수 있습니다."}
                  </span>
                  {(agents.data?.length ?? 0) > 0 ? (
                    <Select
                      value={item.assigneeAgentId ?? ""}
                      disabled={updateAssignment.isPending}
                      onChange={(event) => updateAssignment.mutate(event.target.value)}
                    >
                      <option value="">아직 정하지 않음</option>
                      {(agents.data ?? []).map((candidate) => (
                        <option value={candidate.id} key={candidate.id}>
                          {candidate.name} · {candidate.model.toUpperCase()}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Styled.AssignmentLink as={Link} to="/agents">
                      첫 에이전트 만들기
                    </Styled.AssignmentLink>
                  )}
                </Styled.AssignmentPanel>
              ) : null
            }
          />
          <h2>현재 담당 에이전트</h2>
          {agent ? (
            <Styled.DetailAgent>
              <PetPreview petId={agent.avatarId ?? ""} size={88} />
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.model.toUpperCase()}</small>
                <Styled.AgentSkillList>
                  {agentSkills.map((skill) => (
                    <span key={skill.id}>{skill.name}</span>
                  ))}
                  {agentSkills.length === 0 && (
                    <span>{agent.mode === "worker" ? "기본 업무" : "업무 전환 필요"}</span>
                  )}
                </Styled.AgentSkillList>
              </div>
            </Styled.DetailAgent>
          ) : (
            <Empty>담당자가 없습니다.</Empty>
          )}
          <ExecutionContextPanel
            contexts={executionContexts.data ?? []}
            agents={agents.data ?? []}
            skills={skills.data ?? []}
            loading={executionContexts.isPending}
            error={executionContexts.isError ? messageOf(executionContexts.error) : undefined}
            referenceDocuments={
              <Styled.ReferenceDocuments>
                <div>
                  <strong>참고 문서</strong>
                  <small>{referenceDocuments.length}개 자동 전달</small>
                </div>
                {referenceDocuments.map((document) => (
                  <Link to={`/records?document=${document.id}`} key={document.id}>
                    {document.title}
                  </Link>
                ))}
                {!knowledgeDocuments.isPending && referenceDocuments.length === 0 && (
                  <small>이 작업에 연결된 문서가 없습니다.</small>
                )}
                {(knowledgeDocuments.data?.length ?? 0) > 0 && (
                  <details>
                    <summary>기록실에서 참고 문서 선택</summary>
                    <div>
                      {(knowledgeDocuments.data ?? []).map((document) => {
                        const isSource = document.taskId === item.id;
                        const isReferenced = document.referenceTaskIds.includes(item.id);
                        return (
                          <button
                            type="button"
                            key={document.id}
                            disabled={isSource || toggleReferenceDocument.isPending}
                            onClick={() => toggleReferenceDocument.mutate(document)}
                          >
                            <span>{document.title}</span>
                            <strong>
                              {isSource ? "이 작업에서 생성" : isReferenced ? "제외" : "추가"}
                            </strong>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </Styled.ReferenceDocuments>
            }
          />
          {missingRuntimePermissions && (
            <Styled.PermissionWarning>
              <strong>{agent?.model.toUpperCase()} 실행 권한이 부족합니다.</strong>
              <span>프로젝트 작업을 위해 파일 읽기·수정과 터미널 사용을 허용해 주세요.</span>
              <Button
                $variant="secondary"
                $fullWidth
                onClick={() => repairPermissions.mutate()}
                disabled={repairPermissions.isPending}
              >
                기본 업무 모드로 전환
              </Button>
            </Styled.PermissionWarning>
          )}
          {pendingApproval && (
            <ExecutionRuntimeApproval
              activity={pendingApproval}
              pending={resolveApproval.isPending}
              onDecision={(decision) =>
                resolveApproval.mutate({
                  runId: latestRun!.id,
                  requestId: String(pendingApproval.metadata?.requestId),
                  decision,
                })
              }
            />
          )}
          <dl>
            <div>
              <dt>우선순위</dt>
              <dd>{item.priority ?? "medium"}</dd>
            </div>
            <div>
              <dt>생성</dt>
              <dd>{new Date(item.createdAt).toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>최근 실행</dt>
              <dd>{latestRun?.status ?? "없음"}</dd>
            </div>
          </dl>
          {item.status === "todo" && (
            <ProjectSelect
              workspaceId={workspace.id}
              value={item.projectId ?? ""}
              onChange={(value) => updateProject.mutate(value)}
            />
          )}
          <TechnicalDetails>
            <summary>개발자 옵션</summary>
            {latestRun?.usage && (
              <dl>
                <div>
                  <dt>입력 토큰</dt>
                  <dd>{latestRun.usage.inputTokens?.toLocaleString() ?? "-"}</dd>
                </div>
                <div>
                  <dt>출력 토큰</dt>
                  <dd>{latestRun.usage.outputTokens?.toLocaleString() ?? "-"}</dd>
                </div>
              </dl>
            )}
          </TechnicalDetails>
          {item.status === "failed" && (
            <Button
              $variant="primary"
              $fullWidth
              disabled={!agent || missingRuntimePermissions || retry.isPending}
              onClick={() => retry.mutate()}
            >
              ↻ 실패한 작업 다시 실행
            </Button>
          )}
          {latestRun && ["queued", "running", "waiting"].includes(latestRun.status) && (
            <Button $variant="danger" $fullWidth onClick={() => cancel.mutate(latestRun.id)}>
              실행 취소
            </Button>
          )}
          <Styled.TaskDangerZone>
            <div>
              <strong>이 할 일 삭제</strong>
              <span>실행 기록과 결과도 함께 삭제됩니다.</span>
            </div>
            <Styled.TaskRemoveButton
              type="button"
              disabled={
                remove.isPending ||
                Boolean(latestRun && ["queued", "running", "waiting"].includes(latestRun.status))
              }
              onClick={async () => {
                if (
                  await confirm({
                    title: "할 일을 삭제할까요?",
                    description: `'${item.title}'의 실행 기록과 결과도 함께 삭제됩니다.`,
                    confirmLabel: "할 일 삭제",
                    tone: "danger",
                  })
                )
                  remove.mutate();
              }}
            >
              {remove.isPending ? "삭제 중…" : "할 일 삭제"}
            </Styled.TaskRemoveButton>
          </Styled.TaskDangerZone>
        </Styled.TaskMeta>
      </Styled.DetailLayout>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
