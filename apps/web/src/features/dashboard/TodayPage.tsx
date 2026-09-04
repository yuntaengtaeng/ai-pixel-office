import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import type {
  Agent,
  ActivityLog,
  Task,
  TaskStatus,
  Workspace,
} from "../../../../../packages/domain/src/entities.ts";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { PRIORITIES, RUNTIME, STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, PageHeader } from "../../shared/ui/common.tsx";
import { TaskCard } from "../tasks/TaskCard.tsx";
import { InboxPanel } from "../inbox/InboxPanel.tsx";

const PixelOffice = lazy(async () => {
  const module = await import("../office/PixelOffice.tsx");
  return { default: module.PixelOffice };
});

export function TodayPage({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const activities = useQuery({
    queryKey: ["activities", workspace.id],
    queryFn: () => activityApi.list(workspace.id),
  });
  const [showComposer, setShowComposer] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();
  const agentList = useMemo(() => agents.data ?? [], [agents.data]);
  const taskList = useMemo(() => tasks.data ?? [], [tasks.data]);
  const visibleTasks = useMemo(() => {
    const query = taskSearch.trim().toLocaleLowerCase("ko-KR");
    return taskList.filter(
      (task) =>
        (statusFilter === "all" || task.status === statusFilter) &&
        (!query ||
          `${task.title} ${task.description ?? ""}`.toLocaleLowerCase("ko-KR").includes(query)),
    );
  }, [statusFilter, taskList, taskSearch]);
  const doneToday = visibleTasks.filter(
    (task) => task.status === "done" && isToday(task.completedAt ?? task.updatedAt),
  );
  const filteredActivities = (activities.data ?? []).filter(
    (activity) => activityFilter === "all" || activityCategory(activity) === activityFilter,
  );
  const runtimesPresent = useMemo(
    () => Array.from(new Set(agentList.map((agent) => agent.model))),
    [agentList],
  );
  const officeQuickAssign = useMutation({
    mutationFn: ({
      agentId,
      title,
      description,
    }: {
      agentId: string;
      title: string;
      description?: string;
    }) =>
      taskApi.create({
        workspaceId: workspace.id,
        assigneeAgentId: agentId,
        title,
        description,
        priority: "medium",
      }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const removeTask = useMutation({
    mutationFn: (taskId: string) => taskApi.remove(taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] }),
  });
  const deleteTask = async (task: Task) => {
    if (
      !(await confirm({
        title: "할 일을 삭제할까요?",
        description: `'${task.title}'의 실행 기록과 결과도 함께 삭제됩니다.`,
        confirmLabel: "할 일 삭제",
        tone: "danger",
      }))
    )
      return;
    removeTask.mutate(task.id);
  };
  return (
    <Dialog.Root open={showComposer} onOpenChange={setShowComposer}>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("ko-KR", {
          month: "long",
          day: "numeric",
          weekday: "long",
        }).format(new Date())}
        title="오늘의 오피스"
        action={
          <Dialog.Trigger asChild>
            <button className="primary-button">+ 새 작업</button>
          </Dialog.Trigger>
        }
      />
      <Dialog.Portal>
        <Dialog.Overlay className="task-dialog-overlay" />
        <Dialog.Content className="task-dialog-content">
          <header>
            <div>
              <span className="kicker">NEW TASK</span>
              <Dialog.Title>새 작업 만들기</Dialog.Title>
              <Dialog.Description>
                할 일을 먼저 만들고 다음 화면에서 프로젝트와 담당 에이전트를 정할 수 있어요.
              </Dialog.Description>
            </div>
            <Dialog.Close className="task-dialog-close" aria-label="닫기" title="닫기">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7.05 5.64 4.95 4.95 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41Z" />
              </svg>
            </Dialog.Close>
          </header>
          <TaskComposer workspace={workspace} onDone={() => setShowComposer(false)} />
        </Dialog.Content>
      </Dialog.Portal>
      {(agents.isError || tasks.isError) && (
        <ErrorBanner>{messageOf(agents.error ?? tasks.error)}</ErrorBanner>
      )}
      <section className="office-card">
        <div className="section-heading">
          <div>
            <span className="kicker">LIVE OFFICE</span>
            <h2>우리 팀은 지금</h2>
          </div>
          <div className="office-heading-meta">
            {runtimesPresent.length > 0 && (
              <div className="office-runtime-legend" aria-label="에이전트 런타임 범례">
                {runtimesPresent.map((model) => (
                  <span className="runtime-legend-chip" key={model}>
                    <span
                      className="runtime-legend-dot"
                      style={{ background: RUNTIME[model].color }}
                    />
                    {RUNTIME[model].label}
                  </span>
                ))}
              </div>
            )}
            <span className="live-badge">
              <span className="online-dot" /> 실시간
            </span>
          </div>
        </div>
        <Suspense fallback={<div className="office-loading">픽셀 오피스를 준비하는 중...</div>}>
          <PixelOffice
            agents={agentList}
            tasks={taskList}
            onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
            onQuickAssign={(agentId, title, description) =>
              officeQuickAssign.mutate({ agentId, title, description })
            }
          />
        </Suspense>
        {officeQuickAssign.isError && (
          <ErrorBanner>{messageOf(officeQuickAssign.error)}</ErrorBanner>
        )}
      </section>
      <InboxPanel workspace={workspace} />
      <section className="today-toolbar" aria-label="작업 검색과 상태 필터">
        <label className="task-search">
          <span>⌕</span>
          <input
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="작업 제목이나 설명 검색"
          />
          {taskSearch && (
            <button type="button" onClick={() => setTaskSearch("")} aria-label="검색어 지우기">
              ×
            </button>
          )}
        </label>
        <div className="status-filter-list">
          <button
            className={statusFilter === "all" ? "selected" : ""}
            onClick={() => setStatusFilter("all")}
          >
            전체 <b>{taskList.length}</b>
          </button>
          {(Object.keys(STATUS) as TaskStatus[]).map((status) => (
            <button
              key={status}
              className={statusFilter === status ? "selected" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {STATUS[status].label}{" "}
              <b>{taskList.filter((task) => task.status === status).length}</b>
            </button>
          ))}
        </div>
      </section>
      <div className="today-grid">
        {(["todo", "working", "needs_review", "needs_input", "blocked", "failed"] as TaskStatus[])
          .filter((status) => statusFilter === "all" || statusFilter === status)
          .map((status) => (
            <TaskSection
              key={status}
              status={status}
              tasks={visibleTasks.filter((task) => task.status === status)}
              agents={agentList}
              onDelete={deleteTask}
              deletingId={removeTask.isPending ? removeTask.variables : undefined}
            />
          ))}
      </div>
      <div className="lower-grid">
        {(statusFilter === "all" || statusFilter === "done") && (
          <TaskSection
            status="done"
            title="오늘 완료"
            tasks={doneToday}
            agents={agentList}
            onDelete={deleteTask}
            deletingId={removeTask.isPending ? removeTask.variables : undefined}
          />
        )}
        <section className="panel activity-panel">
          <div className="section-heading compact">
            <h2>최근 활동</h2>
            <select
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
              aria-label="활동 종류 필터"
            >
              <option value="all">전체 {activities.data?.length ?? 0}</option>
              <option value="input">Inbox</option>
              <option value="task">작업</option>
              <option value="approval">승인</option>
              <option value="agent">에이전트</option>
            </select>
          </div>
          <div className="activity-list">
            {filteredActivities.slice(0, showAllActivity ? 20 : 8).map((activity) => (
              <div
                className="activity-item"
                data-category={activityCategory(activity)}
                key={activity.id}
              >
                <span className="activity-pixel" aria-hidden="true" />
                <div>
                  {activity.taskId ? (
                    <Link to={`/tasks/${activity.taskId}`}>{activity.message}</Link>
                  ) : (
                    <strong>{activity.message}</strong>
                  )}
                  <time>{relativeTime(activity.createdAt)}</time>
                </div>
              </div>
            ))}
            {!activities.isPending && filteredActivities.length === 0 && (
              <Empty>아직 활동이 없습니다.</Empty>
            )}
          </div>
          {filteredActivities.length > 8 && (
            <button
              className="activity-more"
              type="button"
              onClick={() => setShowAllActivity((value) => !value)}
            >
              {showAllActivity ? "간단히 보기" : `활동 ${filteredActivities.length - 8}개 더 보기`}
            </button>
          )}
        </section>
      </div>
      {removeTask.isError && <ErrorBanner>{messageOf(removeTask.error)}</ErrorBanner>}
      <ConfirmDialog {...dialogProps} />
    </Dialog.Root>
  );
}

function TaskComposer({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<NonNullable<Task["priority"]>>("medium");
  const resultExamples = [
    {
      label: "결과물 + 변경 내용",
      value: "바로 사용할 수 있는 결과물과 변경 내용을 함께 알려 주세요.",
    },
    {
      label: "선택지 비교 + 추천",
      value: "먼저 선택지를 비교하고 가장 좋은 방법을 추천해 주세요.",
    },
    { label: "확인 방법 + 주의사항", value: "완료 후 확인 방법과 남은 주의사항을 정리해 주세요." },
  ];
  const mutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        workspaceId: workspace.id,
        title,
        description: description || undefined,
        priority,
      }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      onDone();
      navigate(`/tasks/${task.id}`);
    },
  });
  return (
    <form
      className="composer task-dialog-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="field grow">
        <label>무엇을 만들거나 해결할까요?</label>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 컴포넌트 추출"
          required
        />
      </div>
      <fieldset className="priority-field">
        <legend>우선순위</legend>
        <div className="priority-picker">
          {(Object.entries(PRIORITIES) as Array<[NonNullable<Task["priority"]>, string]>).map(
            ([value, label]) => (
              <button
                type="button"
                className={priority === value ? "selected" : ""}
                key={value}
                onClick={() => setPriority(value)}
              >
                <span className="priority-choice-dot" data-priority={value} />
                {label}
              </button>
            ),
          )}
        </div>
      </fieldset>
      <div className="field grow task-result-field">
        <label>원하는 결과 · 선택 사항</label>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="예: 선택한 화면의 버튼과 입력창을 React 컴포넌트로 분리해 주세요"
        />
        <div className="prompt-suggestions" aria-label="원하는 결과 예시">
          {resultExamples.map((example) => (
            <button type="button" key={example.label} onClick={() => setDescription(example.value)}>
              {example.label}
            </button>
          ))}
        </div>
      </div>
      <div className="task-dialog-actions">
        <Dialog.Close type="button" className="secondary-button">
          취소
        </Dialog.Close>
        <button className="primary-button" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? "만드는 중..." : "작업 만들기"}
        </button>
      </div>
      {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
    </form>
  );
}

function TaskSection({
  status,
  title,
  tasks,
  agents,
  onDelete,
  deletingId,
}: {
  status: TaskStatus;
  title?: string;
  tasks: Task[];
  agents: Agent[];
  onDelete: (task: Task) => void;
  deletingId?: string;
}) {
  return (
    <section className={`panel task-section status-${status}`}>
      <div className="section-heading compact">
        <h2>
          <span>{STATUS[status].icon}</span> {title ?? STATUS[status].label}
        </h2>
        <span className="count">{tasks.length}</span>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            agent={agents.find((agent) => agent.id === task.assigneeAgentId)}
            onDelete={
              ["working", "needs_input"].includes(task.status) ? undefined : () => onDelete(task)
            }
            deleting={deletingId === task.id}
          />
        ))}
        {tasks.length === 0 && <Empty>비어 있습니다.</Empty>}
      </div>
    </section>
  );
}

function isToday(value: string): boolean {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function activityCategory(activity: ActivityLog): "input" | "task" | "approval" | "agent" {
  if (activity.type.startsWith("input_")) return "input";
  if (activity.type.startsWith("approval_") || activity.type === "change_requested") {
    return "approval";
  }
  if (activity.type.startsWith("agent_")) return "agent";
  return "task";
}
