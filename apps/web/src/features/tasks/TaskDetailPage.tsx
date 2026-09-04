import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  Agent,
  Skill,
  TaskWorkflowStep,
  WorkflowPreset,
  Workspace,
} from "../../../../../packages/domain/src/entities.ts";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { skillApi } from "../skills/api.ts";
import { workflowApi } from "../workflows/api.ts";
import { taskApi, type TaskDetail, type TaskExecutionContext } from "./api.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, FullScreenMessage } from "../../shared/ui/common.tsx";
import { ProjectDirectorySelect, ProjectSelect } from "../projects/ProjectSelect.tsx";

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
  const updateWorkingDirectory = useMutation({
    mutationFn: (workingDirectory: string) => taskApi.update(id, { workingDirectory }),
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
    updateWorkingDirectory.error ??
    remove.error;
  if (task.isPending) return <FullScreenMessage>작업을 불러오는 중...</FullScreenMessage>;
  if (!item || task.isError)
    return <FullScreenMessage error>{messageOf(task.error)}</FullScreenMessage>;
  const sessionLimitReason = sessionLimitFrom(latestRun?.error);
  const active = ["working", "needs_input"].includes(item.status);
  return (
    <>
      <button className="back-button" onClick={() => navigate(-1)}>
        ← 작업 목록
      </button>
      <div className="task-detail-heading">
        <span className={`status-pill status-${item.status}`}>{STATUS[item.status].label}</span>
        <h1>{item.title}</h1>
        <p>
          {item.status === "todo"
            ? "담당자와 요청 내용을 확인한 뒤 작업을 시작하세요."
            : item.description || "추가 설명이 없습니다."}
        </p>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel result-panel">
            <div className="section-heading compact">
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
            </div>
            {active && latestRun?.request && <CurrentRunRequest request={latestRun.request} />}
            {item.status === "todo" ? (
              <div className="task-brief-editor">
                <label htmlFor="task-brief">에이전트에게 전달할 내용</label>
                <p>
                  배경, 원하는 결과, 지켜야 할 조건을 적어 주세요. 제목과 함께 첫 요청으로
                  전달됩니다.
                </p>
                <textarea
                  id="task-brief"
                  value={taskBrief}
                  onChange={(event) => setTaskBrief(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing &&
                      !updateBrief.isPending &&
                      taskBrief.trim() !== (item.description ?? "").trim()
                    ) {
                      event.preventDefault();
                      updateBrief.mutate();
                    }
                  }}
                  placeholder="예: 현재 UI 구조를 먼저 확인하고, 기존 컴포넌트 스타일을 유지하면서 개선해 주세요."
                  rows={8}
                />
                <div className="task-brief-actions">
                  <small>
                    {taskBrief.trim() === (item.description ?? "").trim()
                      ? "저장된 내용입니다."
                      : "작업 시작 시 변경 내용도 함께 저장됩니다."}
                  </small>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      updateBrief.isPending || taskBrief.trim() === (item.description ?? "").trim()
                    }
                    onClick={() => updateBrief.mutate()}
                  >
                    {updateBrief.isPending ? "저장 중…" : "요청 저장"}
                  </button>
                </div>
              </div>
            ) : sessionLimitReason ? (
              <SessionLimitState
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
              <FailureState error={latestRun?.error} />
            ) : (
              <Empty>작업을 시작하면 여기에 결과가 나타납니다.</Empty>
            )}
            {item.status === "needs_review" && (
              <div className="review-box">
                <div className="review-copy">
                  <strong>이어서 요청할 내용이 있나요?</strong>
                  <p>같은 작업 흐름에서 추가 요청을 바로 전달할 수 있어요.</p>
                </div>
                <form
                  className="review-followup"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (feedback.trim() && !changes.isPending) changes.mutate();
                  }}
                >
                  <input
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="추가로 요청할 내용을 입력하세요."
                  />
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!feedback.trim() || changes.isPending}
                  >
                    이어서 요청
                  </button>
                </form>
                <div className="review-finish">
                  <span>결과가 충분하다면 이 작업을 마무리하세요.</span>
                  <button
                    className="secondary-button"
                    onClick={() => approve.mutate()}
                    disabled={approve.isPending}
                  >
                    세션 종료
                  </button>
                </div>
              </div>
            )}
            {actionError && <ErrorBanner>{messageOf(actionError)}</ErrorBanner>}
          </section>
          <RunHistory runs={item.runs} progressByRun={item.progressByRun} />
        </div>
        <aside className="panel task-meta">
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
                <div className="assignment-panel">
                  <strong>
                    {agent ? "담당자를 변경할 수 있어요" : "먼저 담당자를 배치해 주세요"}
                  </strong>
                  <span>
                    {agent
                      ? "작업을 시작하기 전까지 변경할 수 있습니다."
                      : "작업에 맞는 에이전트를 선택하면 시작할 수 있습니다."}
                  </span>
                  {(agents.data?.length ?? 0) > 0 ? (
                    <select
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
                    </select>
                  ) : (
                    <Link className="secondary-button assignment-link" to="/agents">
                      첫 에이전트 만들기
                    </Link>
                  )}
                </div>
              ) : null
            }
          />
          <h2>현재 담당 에이전트</h2>
          {agent ? (
            <div className="detail-agent">
              <PetPreview petId={agent.avatarId ?? ""} size={88} />
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.model.toUpperCase()}</small>
                <div className="agent-skill-list">
                  {agentSkills.map((skill) => (
                    <span key={skill.id}>{skill.name}</span>
                  ))}
                  {agentSkills.length === 0 && (
                    <span>{agent.mode === "worker" ? "기본 업무" : "업무 전환 필요"}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Empty>담당자가 없습니다.</Empty>
          )}
          <ExecutionContextPanel
            contexts={executionContexts.data ?? []}
            agents={agents.data ?? []}
            skills={skills.data ?? []}
            loading={executionContexts.isPending}
            error={executionContexts.isError ? messageOf(executionContexts.error) : undefined}
          />
          {missingRuntimePermissions && (
            <div className="permission-warning">
              <strong>{agent?.model.toUpperCase()} 실행 권한이 부족합니다.</strong>
              <span>프로젝트 작업을 위해 파일 읽기·수정과 터미널 사용을 허용해 주세요.</span>
              <button
                className="secondary-button wide"
                onClick={() => repairPermissions.mutate()}
                disabled={repairPermissions.isPending}
              >
                기본 업무 모드로 전환
              </button>
            </div>
          )}
          {pendingApproval && (
            <RuntimeApproval
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
          <details className="technical-details">
            <summary>개발자 옵션</summary>
            <ProjectDirectorySelect
              workspaceId={workspace.id}
              value={item.workingDirectory ?? ""}
              onChange={(value) => updateWorkingDirectory.mutate(value)}
              label="실행 폴더 덮어쓰기"
              emptyLabel="프로젝트/에이전트 기본값"
            />
            {latestRun?.usage && (
              <dl className="technical-usage">
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
          </details>
          {item.status === "todo" && (
            <button
              className="primary-button wide"
              disabled={!agent || missingRuntimePermissions || run.isPending}
              onClick={() => run.mutate()}
            >
              ▶ 작업 시작
            </button>
          )}
          {item.status === "failed" && (
            <button
              className="primary-button wide"
              disabled={!agent || missingRuntimePermissions || retry.isPending}
              onClick={() => retry.mutate()}
            >
              ↻ 실패한 작업 다시 실행
            </button>
          )}
          {latestRun && ["queued", "running", "waiting"].includes(latestRun.status) && (
            <button className="danger-button wide" onClick={() => cancel.mutate(latestRun.id)}>
              실행 취소
            </button>
          )}
          <div className="task-danger-zone">
            <div>
              <strong>이 할 일 삭제</strong>
              <span>실행 기록과 결과도 함께 삭제됩니다.</span>
            </div>
            <button
              type="button"
              className="danger-button task-remove-button"
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
            </button>
          </div>
        </aside>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

function WorkflowPanel({
  task,
  agents,
  saving,
  onSave,
  presets,
  presetSaving,
  onCreatePreset,
  onDeletePreset,
  singleAssignment,
}: {
  task: TaskDetail;
  agents: Agent[];
  saving: boolean;
  onSave: (agentIds: string[]) => void;
  presets: WorkflowPreset[];
  presetSaving: boolean;
  onCreatePreset: (name: string, agentIds: string[]) => void;
  onDeletePreset: (preset: WorkflowPreset) => void;
  singleAssignment: ReactNode;
}) {
  const [agentIds, setAgentIds] = useState(() => task.workflow.map((step) => step.agentId));
  const [editing, setEditing] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const editable = task.status === "todo" && task.runs.length === 0;
  useEffect(() => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  }, [task.workflow]);
  const startConfiguring = () => {
    const first = task.assigneeAgentId ?? agents[0]?.id;
    const second = agents.find((agent) => agent.id !== first)?.id;
    setAgentIds([first, second].filter((id): id is string => Boolean(id)));
    setEditing(true);
  };
  const updateAgent = (position: number, agentId: string) => {
    setSelectedPresetId("");
    setAgentIds((current) => current.map((id, index) => (index === position ? agentId : id)));
  };
  const move = (position: number, direction: -1 | 1) => {
    setSelectedPresetId("");
    setAgentIds((current) => {
      const target = position + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[position], next[target]] = [next[target]!, next[position]!];
      return next;
    });
  };
  const hasDuplicates = new Set(agentIds).size !== agentIds.length;
  const sequential = task.workflow.length > 0 || editing;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const cancelEditing = () => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  };
  const chooseSingle = () => {
    if (task.workflow.length > 0) onSave([]);
    else cancelEditing();
  };

  return (
    <section className="workflow-panel">
      <div className="section-heading compact">
        <h2>담당 방식</h2>
      </div>
      {editable && (
        <div className="assignment-mode-switch" aria-label="담당 방식 선택">
          <button
            type="button"
            className={!sequential ? "selected" : ""}
            onClick={chooseSingle}
            disabled={saving}
          >
            한 명에게 맡기기
          </button>
          <button
            type="button"
            className={sequential ? "selected" : ""}
            onClick={() => {
              if (!sequential) startConfiguring();
              else if (task.workflow.length > 0) setEditing(true);
            }}
            disabled={agents.length < 2 || saving}
          >
            순차 협업
          </button>
        </div>
      )}
      {!sequential ? (
        (singleAssignment ?? <p className="workflow-empty">한 명이 이 작업을 담당합니다.</p>)
      ) : task.workflow.length > 0 && !editable ? (
        <ol className="workflow-progress-list">
          {task.workflow.map((step) => (
            <WorkflowProgressStep
              key={step.id}
              step={step}
              agent={agents.find((a) => a.id === step.agentId)}
            />
          ))}
        </ol>
      ) : editing ? (
        <div className="workflow-editor">
          <div className="workflow-preset-picker">
            <label htmlFor="workflow-preset">저장된 협업 그룹</label>
            <div>
              <select
                id="workflow-preset"
                value={selectedPresetId}
                onChange={(event) => {
                  const preset = presets.find((entry) => entry.id === event.target.value);
                  setSelectedPresetId(event.target.value);
                  if (preset) setAgentIds(preset.agentIds);
                }}
              >
                <option value="">직접 순서 구성</option>
                {presets.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    disabled={preset.agentIds.some(
                      (id) => !agents.some((agent) => agent.id === id),
                    )}
                  >
                    {preset.name} · {preset.agentIds.length}명
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="workflow-preset-delete"
                disabled={!selectedPreset || presetSaving}
                onClick={() => selectedPreset && onDeletePreset(selectedPreset)}
                aria-label="선택한 협업 그룹 삭제"
              >
                삭제
              </button>
            </div>
          </div>
          {agentIds.map((agentId, position) => (
            <div className="workflow-editor-step" key={`${position}-${agentId}`}>
              <div className="workflow-step-main">
                <span>{position + 1}</span>
                <select
                  value={agentId}
                  onChange={(event) => updateAgent(position, event.target.value)}
                >
                  {agents.map((agent) => (
                    <option value={agent.id} key={agent.id}>
                      {agent.name} · {agent.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="workflow-step-controls">
                <span>
                  {position === agentIds.length - 1 ? "최종 단계" : "완료 후 다음 단계로 전달"}
                </span>
                <button
                  type="button"
                  onClick={() => move(position, -1)}
                  disabled={position === 0}
                  aria-label="앞 단계로 이동"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(position, 1)}
                  disabled={position === agentIds.length - 1}
                  aria-label="뒤 단계로 이동"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPresetId("");
                    setAgentIds((current) => current.filter((_, index) => index !== position));
                  }}
                  disabled={agentIds.length <= 2}
                  title={agentIds.length <= 2 ? "순차 협업에는 최소 2명이 필요합니다." : undefined}
                  aria-label="단계 삭제"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="workflow-add-step"
            disabled={agentIds.length >= Math.min(8, agents.length)}
            onClick={() => {
              const next = agents.find((agent) => !agentIds.includes(agent.id));
              if (next) {
                setSelectedPresetId("");
                setAgentIds((current) => [...current, next.id]);
              }
            }}
          >
            + 다음 단계 추가
          </button>
          <form
            className="workflow-preset-save"
            onSubmit={(event) => {
              event.preventDefault();
              if (presetName.trim() && agentIds.length >= 2 && !hasDuplicates && !presetSaving) {
                onCreatePreset(presetName, agentIds);
                setPresetName("");
              }
            }}
          >
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="이 순서의 그룹 이름"
              aria-label="협업 그룹 이름"
            />
            <button
              type="submit"
              className="secondary-button"
              disabled={!presetName.trim() || agentIds.length < 2 || hasDuplicates || presetSaving}
            >
              그룹 저장
            </button>
          </form>
          <div className="workflow-editor-actions">
            <button type="button" className="secondary-button" onClick={cancelEditing}>
              편집 취소
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={saving || agentIds.length < 2 || hasDuplicates}
              onClick={() => onSave(agentIds)}
            >
              순서 저장
            </button>
          </div>
          {hasDuplicates && (
            <small className="workflow-error">같은 에이전트를 중복 배치할 수 없습니다.</small>
          )}
        </div>
      ) : task.workflow.length > 0 ? (
        <div className="workflow-summary">
          <ol>
            {task.workflow.map((step) => (
              <li key={step.id}>
                <span>{step.position + 1}</span>
                <strong>
                  {agents.find((agent) => agent.id === step.agentId)?.name ?? "삭제된 에이전트"}
                </strong>
              </li>
            ))}
          </ol>
          <button type="button" className="secondary-button wide" onClick={() => setEditing(true)}>
            협업 순서 편집
          </button>
        </div>
      ) : (
        <p className="workflow-empty">
          {agents.length < 2
            ? "순차 협업에는 에이전트가 2명 이상 필요합니다."
            : "이 작업은 단일 에이전트로 진행됩니다."}
        </p>
      )}
    </section>
  );
}

function CurrentRunRequest({ request }: { request: string }) {
  return (
    <div className="current-run-request">
      <span>현재 요청</span>
      <p>{request}</p>
    </div>
  );
}

function PreviousResult({ result }: { result: NonNullable<TaskDetail["result"]> }) {
  return (
    <details className="previous-result">
      <summary>이전 결과 보기</summary>
      <div>
        <TaskResultView result={result} />
      </div>
    </details>
  );
}

function ExecutionContextPanel({
  contexts,
  agents,
  skills,
  loading,
  error,
}: {
  contexts: TaskExecutionContext[];
  agents: Agent[];
  skills: Skill[];
  loading: boolean;
  error?: string;
}) {
  return (
    <section className="execution-context">
      <div className="execution-context-heading">
        <strong>실행 컨텍스트</strong>
        <span>PROJECT</span>
      </div>
      {loading ? (
        <small>프로젝트 지침을 확인하는 중입니다.</small>
      ) : error ? (
        <small className="execution-context-error">{error}</small>
      ) : contexts.length === 0 ? (
        <small>담당자를 정하면 실행 컨텍스트를 확인할 수 있습니다.</small>
      ) : (
        contexts.map((context) => {
          const contextAgent = agents.find((candidate) => candidate.id === context.agentId);
          const mappedSkills = skills.filter((skill) => contextAgent?.skillIds.includes(skill.id));
          return (
            <details
              key={context.workflowStepId ?? context.agentId}
              className="execution-context-item"
              open={contexts.length === 1}
            >
              <summary>
                <span>{context.position === undefined ? "1" : context.position + 1}</span>
                <div>
                  <strong>{context.agentName}</strong>
                  <small>{context.runtime.toUpperCase()}</small>
                </div>
              </summary>
              <div className="execution-context-body">
                <code title={context.workingDirectory}>{context.workingDirectory}</code>
                <ContextGroup label={`${context.runtime.toUpperCase()} 프로젝트 지침`}>
                  {context.instructionFiles.length > 0 ? (
                    context.instructionFiles.map((path) => (
                      <span title={path} key={path}>
                        {fileName(path)} 감지됨
                      </span>
                    ))
                  ) : (
                    <small>설정된 프로젝트 지침이 없습니다.</small>
                  )}
                </ContextGroup>
                <ContextGroup label="프로젝트 스킬">
                  {context.projectSkills.length > 0 ? (
                    context.projectSkills.map((skill) => (
                      <span title={skill.path} key={skill.path}>
                        {skill.name}
                      </span>
                    ))
                  ) : (
                    <small>감지된 프로젝트 스킬이 없습니다.</small>
                  )}
                </ContextGroup>
                <ContextGroup label="동료에게 매핑된 스킬">
                  {mappedSkills.length > 0 ? (
                    mappedSkills.map((skill) => <span key={skill.id}>{skill.name}</span>)
                  ) : (
                    <small>기본 업무 능력으로 실행합니다.</small>
                  )}
                </ContextGroup>
              </div>
            </details>
          );
        })
      )}
      <p>파일 존재 여부만 표시하며, 실제 해석과 적용은 각 런타임이 담당합니다.</p>
    </section>
  );
}

function ContextGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="execution-context-group">
      <b>{label}</b>
      <div>{children}</div>
    </div>
  );
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function RunHistory({
  runs,
  progressByRun,
}: {
  runs: TaskDetail["runs"];
  progressByRun: TaskDetail["progressByRun"];
}) {
  const statusLabel: Record<TaskDetail["runs"][number]["status"], string> = {
    queued: "대기",
    running: "실행 중",
    waiting: "입력 대기",
    completed: "완료",
    failed: "실패",
    cancelled: "취소",
  };
  return (
    <section className="panel run-history">
      <div className="section-heading compact">
        <h2>실행 기록</h2>
        <span>{runs.length}</span>
      </div>
      {runs.map((entry) => {
        const progress = progressByRun[entry.id] ?? [];
        return (
          <details className={`run-entry run-entry-${entry.status}`} key={entry.id}>
            <summary className="run-row">
              <span className={`run-dot run-${entry.status}`} />
              <strong>{entry.runtime.toUpperCase()}</strong>
              <span>{statusLabel[entry.status]}</span>
              <time>{new Date(entry.createdAt).toLocaleString("ko-KR")}</time>
              <span className="run-expand-icon" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="run-entry-body">
              {entry.request && (
                <section className="run-request-snapshot">
                  <strong>요청</strong>
                  <p>{entry.request}</p>
                </section>
              )}
              {entry.result && (
                <section className="run-result-snapshot">
                  <strong>이 실행의 결과</strong>
                  <TaskResultView result={entry.result} />
                </section>
              )}
              {entry.status === "failed" && (
                <section className="run-error-snapshot">
                  <strong>실패 로그</strong>
                  <pre>{entry.error || "기록된 오류 메시지가 없습니다."}</pre>
                </section>
              )}
              {progress.length > 0 && (
                <div className="run-entry-events">
                  {progress.slice(-12).map((event) => (
                    <div key={event.id}>
                      <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
                      <span>{event.message}</span>
                    </div>
                  ))}
                </div>
              )}
              <dl>
                {entry.workingDirectory && (
                  <div>
                    <dt>작업 폴더</dt>
                    <dd>{entry.workingDirectory}</dd>
                  </div>
                )}
                <div>
                  <dt>실행 ID</dt>
                  <dd>{entry.id}</dd>
                </div>
                {entry.runtimeThreadId && (
                  <div>
                    <dt>세션 ID</dt>
                    <dd>{entry.runtimeThreadId}</dd>
                  </div>
                )}
                {entry.eventLogRef && (
                  <div>
                    <dt>상세 로그</dt>
                    <dd>{entry.eventLogRef}</dd>
                  </div>
                )}
              </dl>
              {!entry.request &&
                !entry.result &&
                entry.status !== "failed" &&
                progress.length === 0 && (
                  <small>이전 버전에서 생성되어 상세 스냅샷이 없는 실행입니다.</small>
                )}
            </div>
          </details>
        );
      })}
      {runs.length === 0 && <Empty>실행 기록이 없습니다.</Empty>}
    </section>
  );
}

function WorkflowResults({
  task,
  agents,
  error,
}: {
  task: TaskDetail;
  agents: Agent[];
  error?: string;
}) {
  const completedSteps = task.workflow.filter((step) => step.result);
  const finalReady = ["needs_review", "done"].includes(task.status) && task.result;
  return (
    <div className="workflow-results">
      {finalReady ? (
        <section className="workflow-final-result">
          <div className="workflow-result-label">
            <strong>최종 결과</strong>
            <span>{agents.find((agent) => agent.id === task.workflow.at(-1)?.agentId)?.name}</span>
          </div>
          <TaskResultView result={task.result!} />
        </section>
      ) : task.status === "failed" ? (
        <FailureState error={error} />
      ) : (
        <>
          <WorkInProgress waiting={task.status === "needs_input"} />
          <RunProgress events={task.progress} />
        </>
      )}
      <section className="workflow-step-results">
        <div className="workflow-step-results-heading">
          <strong>단계별 결과</strong>
          <span>
            {completedSteps.length}/{task.workflow.length}
          </span>
        </div>
        {completedSteps.map((step) => {
          const stepAgent = agents.find((agent) => agent.id === step.agentId);
          return (
            <details
              key={step.id}
              id={`workflow-result-${step.id}`}
              className="workflow-result-step"
            >
              <summary>
                <span>{step.position + 1}</span>
                <div>
                  <strong>{stepAgent?.name ?? "삭제된 에이전트"}</strong>
                  <small>{stepAgent?.role ?? "역할 정보 없음"}</small>
                </div>
                <b>결과 보기</b>
              </summary>
              <div className="workflow-result-body">
                <TaskResultView result={step.result!} />
              </div>
            </details>
          );
        })}
        {completedSteps.length === 0 && <Empty>첫 번째 단계 결과를 기다리는 중입니다.</Empty>}
      </section>
    </div>
  );
}

function TaskResultView({ result }: { result: NonNullable<TaskDetail["result"]> }) {
  return (
    <>
      <div className="result-summary markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
      </div>
      {result.artifacts?.map((artifact) => (
        <div className="artifact" key={artifact.name}>
          <span>▤</span>
          <div>
            <strong>{artifact.name}</strong>
            <small>{artifact.path ?? artifact.url ?? artifact.type}</small>
          </div>
        </div>
      ))}
    </>
  );
}

function WorkflowProgressStep({ step, agent }: { step: TaskWorkflowStep; agent?: Agent }) {
  const labels: Record<TaskWorkflowStep["status"], string> = {
    pending: "대기",
    working: "작업 중",
    completed: "완료",
    failed: "실패",
  };
  return (
    <li data-status={step.status} className={step.result ? "has-result" : undefined}>
      <span>{step.position + 1}</span>
      <div>
        <strong>{agent?.name ?? "삭제된 에이전트"}</strong>
        <small>{labels[step.status]}</small>
        {step.result && <p>{step.result.summary}</p>}
      </div>
      {step.result && (
        <button
          type="button"
          className="workflow-step-jump"
          aria-label={`${step.position + 1}단계 ${agent?.name ?? "에이전트"} 결과로 이동`}
          title="단계 결과 펼쳐보기"
          onClick={() => revealWorkflowResult(step.id)}
        />
      )}
    </li>
  );
}

function revealWorkflowResult(stepId: string): void {
  const result = document.getElementById(`workflow-result-${stepId}`);
  if (!(result instanceof HTMLDetailsElement)) return;
  result.open = true;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
  window.requestAnimationFrame(() => {
    result.querySelector("summary")?.focus({ preventScroll: true });
  });
}

function WorkInProgress({ waiting }: { waiting: boolean }) {
  return (
    <div className={`work-progress ${waiting ? "waiting" : ""}`}>
      <div className="progress-pixels">
        <span />
        <span />
        <span />
        <span />
      </div>
      <strong>
        {waiting ? "에이전트가 승인을 기다리고 있어요" : "에이전트가 작업하고 있어요"}
      </strong>
      <p>
        {waiting
          ? "오른쪽의 승인 요청을 확인하면 작업이 계속됩니다."
          : "파일을 살펴보고 결과를 정리하는 중입니다. 이 화면은 자동으로 갱신됩니다."}
      </p>
    </div>
  );
}
function RunProgress({ events }: { events: Awaited<ReturnType<typeof taskApi.get>>["progress"] }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [events.length]);
  return (
    <div className="run-progress">
      <div className="run-progress-heading">
        <strong>실시간 진행</strong>
        <span>{events.length}</span>
      </div>
      <div className="run-progress-list" ref={listRef}>
        {events.slice(-30).map((event) => (
          <div className={`progress-event progress-${event.type}`} key={event.id}>
            <span>
              {event.type === "tool_started"
                ? "▶"
                : event.type === "tool_completed"
                  ? "✓"
                  : event.type === "permission_requested"
                    ? "!"
                    : "·"}
            </span>
            <div>
              <p>{event.message}</p>
              {typeof event.metadata?.detail === "string" && <code>{event.metadata.detail}</code>}
              <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
            </div>
          </div>
        ))}
        {events.length === 0 && <Empty>첫 번째 실행 이벤트를 기다리는 중...</Empty>}
      </div>
    </div>
  );
}
function SessionLimitState({
  reason,
  canExtend,
  extendPending,
  newSessionPending,
  onExtend,
  onNewSession,
}: {
  reason: "capacity" | "inactivity" | "duration";
  canExtend: boolean;
  extendPending: boolean;
  newSessionPending: boolean;
  onExtend: () => void;
  onNewSession: () => void;
}) {
  const descriptions = {
    capacity:
      "현재 진행 내용과 변경된 파일을 보존했습니다. 기존 대화를 유지한 채 세션 한도를 늘려 계속할 수 있습니다.",
    inactivity:
      "5분 동안 새로운 진행이 없어 안전하게 중단했습니다. 기존 대화와 작업 폴더를 그대로 유지해 다시 시작할 수 있습니다.",
    duration:
      "20분 실행 한도에 도달했습니다. 기존 대화와 현재까지의 변경 내용을 유지한 채 계속할 수 있습니다.",
  } as const;
  return (
    <div className="session-limit-state">
      <span>↻</span>
      <div>
        <strong>작업 세션이 일시 중단되었습니다.</strong>
        <p>{descriptions[reason]}</p>
        <div className="session-limit-actions">
          {canExtend && (
            <button
              className="primary-button"
              disabled={extendPending || newSessionPending}
              onClick={onExtend}
            >
              {extendPending ? "기존 세션 다시 여는 중…" : "같은 세션 한도 늘려 계속"}
            </button>
          )}
          <button
            className="secondary-button"
            disabled={extendPending || newSessionPending}
            onClick={onNewSession}
          >
            {newSessionPending ? "새 세션 준비 중…" : "새 세션에서 이어가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
function sessionLimitFrom(error?: string): "capacity" | "inactivity" | "duration" | undefined {
  const match = error?.match(/^SESSION_LIMIT:(capacity|inactivity|duration):/);
  return match?.[1] as "capacity" | "inactivity" | "duration" | undefined;
}
function FailureState({ error }: { error?: string }) {
  return (
    <div className="failure-state">
      <span>!</span>
      <div>
        <strong>작업을 완료하지 못했습니다.</strong>
        <p>
          {error || "실행이 예기치 않게 종료되었습니다. 실행 기록을 확인한 뒤 다시 시도해 주세요."}
        </p>
      </div>
    </div>
  );
}
function RuntimeApproval({
  activity,
  pending,
  onDecision,
}: {
  activity: Awaited<ReturnType<typeof activityApi.list>>[number];
  pending: boolean;
  onDecision: (decision: "accept" | "cancel") => void;
}) {
  const details = (activity.metadata?.details ?? {}) as Record<string, unknown>;
  const reason =
    typeof details.reason === "string"
      ? details.reason
      : "에이전트가 명령 실행 권한을 요청했습니다.";
  const command = typeof details.command === "string" ? details.command : undefined;
  return (
    <div className="runtime-approval">
      <span className="kicker">APPROVAL REQUIRED</span>
      <strong>작업을 계속하려면 승인이 필요합니다.</strong>
      <p>{reason}</p>
      {command && <pre>{command}</pre>}
      <div>
        <button className="primary-button" disabled={pending} onClick={() => onDecision("accept")}>
          이번만 승인
        </button>
        <button className="danger-button" disabled={pending} onClick={() => onDecision("cancel")}>
          거절
        </button>
      </div>
    </div>
  );
}
