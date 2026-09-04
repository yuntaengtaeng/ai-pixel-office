import { colors, mediaQuery } from "@ai-pixel-office/design-token";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "radix-ui";
import styled, { keyframes } from "styled-components";
import { Button, CloseIcon, Input, Kicker, Select } from "@ai-pixel-office/ui";
import type {
  Agent,
  ActivityLog,
  Task,
  TaskStatus,
  Workspace,
} from "@ai-pixel-office/domain/entities";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { PRIORITIES, PRIORITY_COLORS, RUNTIME, STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { TaskCard } from "../tasks/TaskCard.tsx";
import { InboxPanel } from "../inbox/InboxPanel.tsx";

const PixelOffice = lazy(async () => {
  const module = await import("../office/PixelOffice.tsx");
  return { default: module.PixelOffice };
});

const dialogFade = keyframes`
  from {
    opacity: 0;
  }
`;

const dialogPop = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.98);
  }
`;

const Styled = {
  DialogOverlay: styled(Dialog.Overlay)`
    position: fixed;
    inset: 0;
    z-index: ${({ theme }) => theme.zIndex.notification};
    background: rgb(31 38 36 / 62%);
    backdrop-filter: blur(2px);
    animation: ${dialogFade} 0.16s ease-out;
  `,
  DialogContent: styled(Dialog.Content)`
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: ${({ theme }) => theme.zIndex.notification};
    width: min(680px, calc(100vw - 28px));
    max-height: calc(100vh - 32px);
    padding: 24px;
    overflow: auto;
    transform: translate(-50%, -50%);
    border: 3px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    box-shadow: 8px 8px 0 rgb(20 31 28 / 48%);
    animation: ${dialogPop} 0.18s ease-out;

    > header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px dashed ${({ theme }) => theme.colors.border.default};
    }

    h2 {
      margin: 4px 0 8px;
      font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
    }

    header p {
      margin: 0;
      max-width: 540px;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.55;
    }
  `,
  DialogClose: styled(Dialog.Close)`
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.radius.circle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.secondary};
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      color 0.14s,
      background 0.14s,
      border-color 0.14s;

    svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    &:hover,
    &:focus-visible {
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      outline: none;
    }
  `,
  DialogActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `,
  PriorityField: styled.fieldset`
    margin: 0;
    padding: 0;
    border: 0;

    legend {
      margin-bottom: 8px;
    }
  `,
  PriorityPicker: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    button {
      min-height: 36px;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;

      &.selected {
        border: 2px solid ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.background.positiveSubtle};
        color: ${({ theme }) => theme.colors.text.positive};
      }
    }
  `,
  PriorityChoiceDot: styled.span<{ $priority: NonNullable<Task["priority"]> }>`
    width: 7px;
    height: 7px;
    margin-right: 8px;
    display: inline-block;
    background: ${({ $priority }) => PRIORITY_COLORS[$priority]};
  `,
  ResultField: styled.div`
    min-width: 0;

    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  HeadingMeta: styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
  RuntimeLegend: styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
  RuntimeLegendChip: styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    color: ${({ theme }) => theme.colors.text.secondary};
  `,
  RuntimeLegendDot: styled.span`
    width: 9px;
    height: 9px;
    border-radius: ${({ theme }) => theme.radius.circle};
    display: inline-block;
  `,
  OnlineDot: styled.span`
    width: 8px;
    height: 8px;
    background: ${({ theme }) => theme.colors.brand.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.border.positive};
    display: inline-block;
  `,
  Toolbar: styled.section`
    display: grid;
    grid-template-columns: minmax(220px, 0.8fr) minmax(0, 2fr);
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;

    @media ${mediaQuery.mobile} {
      grid-template-columns: 1fr;
    }
  `,
  Search: styled.label`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    min-height: 38px;
    padding: 0 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.muted};

    input {
      min-width: 0;
      padding: 8px;
      border: 0;
      outline: 0;
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
      font-family: inherit;
    }

    button {
      border: 0;
      background: transparent;
      color: ${({ theme }) => theme.colors.text.muted};
      cursor: pointer;
    }
  `,
  StatusFilterList: styled.div`
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 4px 0 4px;

    button {
      flex: 0 0 auto;
      padding: 8px 8px;
      border: 1px solid ${({ theme }) => theme.colors.shadow.default};
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;

      &.selected {
        border-color: ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.brand.primary};
        color: ${({ theme }) => theme.colors.background.surface};
      }
    }

    b {
      margin-left: 4px;
      font-family: monospace;
    }
  `,
  TodayGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;

    @media ${mediaQuery.desktopSmall} {
      grid-template-columns: repeat(2, 1fr);
    }

    @media ${mediaQuery.mobile} {
      grid-template-columns: 1fr;
    }
  `,
  TaskSection: styled.section<{ $status: TaskStatus }>`
    min-height: 185px;
    padding: 16px;
    border-top-color: ${({ $status }) => STATUS[$status].color};
  `,
  TaskList: styled.div`
    display: grid;
    gap: 8px;
    max-height: 360px;
    overflow: auto;
  `,
  LowerGrid: styled.div`
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 20px;
    margin-top: 20px;

    > :only-child {
      grid-column: 1 / -1;
    }

    @media ${mediaQuery.mobile} {
      grid-template-columns: 1fr;
    }
  `,
  ActivityPanel: styled.section`
    padding: 16px;

    .section-heading select {
      min-width: 0;
      flex: 1 1 auto;
      margin-left: 12px;
      padding: 4px 8px;
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
      font-family: inherit;
    }

    .section-heading h2 {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  `,
  ActivityList: styled.div`
    display: grid;
    max-height: 245px;
    overflow: auto;
  `,
  ActivityItem: styled.div<{ $category: "input" | "task" | "approval" | "agent" }>`
    display: grid;
    grid-template-columns: 12px 1fr;
    gap: 8px;
    padding: 8px 4px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

    div {
      display: grid;
      gap: 4px;
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    a {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    time {
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
  ActivityPixel: styled.span<{ $category: "input" | "task" | "approval" | "agent" }>`
    width: 7px;
    height: 7px;
    margin-top: 4px;
    box-shadow: 2px 2px 0 ${({ theme }) => theme.colors.border.positive};
    background: ${({ $category }) =>
      $category === "input"
        ? colors.semantic.info
        : $category === "approval"
          ? colors.status.needsReview
          : $category === "agent"
            ? colors.semantic.warning
            : colors.semantic.positive};
  `,
  ActivityMore: styled.button`
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.colors.shadow.default};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  `,
  Composer: styled.form`
    margin: 0;
    padding: 0;
    display: grid;
    gap: 16px;
    align-items: end;
  `,
};

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
    <BaseLayout>
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
              <Button $variant="primary">+ 새 작업</Button>
            </Dialog.Trigger>
          }
        />
        <Dialog.Portal>
          <Styled.DialogOverlay />
          <Styled.DialogContent>
            <header>
              <div>
                <Kicker>NEW TASK</Kicker>
                <Dialog.Title>새 작업 만들기</Dialog.Title>
                <Dialog.Description>
                  할 일을 먼저 만들고 다음 화면에서 프로젝트와 담당 에이전트를 정할 수 있어요.
                </Dialog.Description>
              </div>
              <Styled.DialogClose aria-label="닫기" title="닫기">
                <CloseIcon size={16} />
              </Styled.DialogClose>
            </header>
            <TaskComposer workspace={workspace} onDone={() => setShowComposer(false)} />
          </Styled.DialogContent>
        </Dialog.Portal>
        {(agents.isError || tasks.isError) && (
          <ErrorBanner>{messageOf(agents.error ?? tasks.error)}</ErrorBanner>
        )}
        <section className="office-card">
          <div className="section-heading">
            <div>
              <Kicker>LIVE OFFICE</Kicker>
              <h2>우리 팀은 지금</h2>
            </div>
            <Styled.HeadingMeta>
              {runtimesPresent.length > 0 && (
                <Styled.RuntimeLegend aria-label="에이전트 런타임 범례">
                  {runtimesPresent.map((model) => (
                    <Styled.RuntimeLegendChip key={model}>
                      <Styled.RuntimeLegendDot style={{ background: RUNTIME[model].color }} />
                      {RUNTIME[model].label}
                    </Styled.RuntimeLegendChip>
                  ))}
                </Styled.RuntimeLegend>
              )}
              <span className="live-badge">
                <Styled.OnlineDot /> 실시간
              </span>
            </Styled.HeadingMeta>
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
        <Styled.Toolbar aria-label="작업 검색과 상태 필터">
          <Styled.Search>
            <span>⌕</span>
            <Input
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
              placeholder="작업 제목이나 설명 검색"
            />
            {taskSearch && (
              <button type="button" onClick={() => setTaskSearch("")} aria-label="검색어 지우기">
                ×
              </button>
            )}
          </Styled.Search>
          <Styled.StatusFilterList>
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
          </Styled.StatusFilterList>
        </Styled.Toolbar>
        <Styled.TodayGrid>
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
        </Styled.TodayGrid>
        <Styled.LowerGrid>
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
          <Styled.ActivityPanel className="panel">
            <div className="section-heading compact">
              <h2>최근 활동</h2>
              <Select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value)}
                aria-label="활동 종류 필터"
              >
                <option value="all">전체 {activities.data?.length ?? 0}</option>
                <option value="input">Inbox</option>
                <option value="task">작업</option>
                <option value="approval">승인</option>
                <option value="agent">에이전트</option>
              </Select>
            </div>
            <Styled.ActivityList>
              {filteredActivities.slice(0, showAllActivity ? 20 : 8).map((activity) => (
                <Styled.ActivityItem $category={activityCategory(activity)} key={activity.id}>
                  <Styled.ActivityPixel $category={activityCategory(activity)} aria-hidden="true" />
                  <div>
                    {activity.taskId ? (
                      <Link to={`/tasks/${activity.taskId}`}>{activity.message}</Link>
                    ) : (
                      <strong>{activity.message}</strong>
                    )}
                    <time>{relativeTime(activity.createdAt)}</time>
                  </div>
                </Styled.ActivityItem>
              ))}
              {!activities.isPending && filteredActivities.length === 0 && (
                <Empty>아직 활동이 없습니다.</Empty>
              )}
            </Styled.ActivityList>
            {filteredActivities.length > 8 && (
              <Styled.ActivityMore
                type="button"
                onClick={() => setShowAllActivity((value) => !value)}
              >
                {showAllActivity
                  ? "간단히 보기"
                  : `활동 ${filteredActivities.length - 8}개 더 보기`}
              </Styled.ActivityMore>
            )}
          </Styled.ActivityPanel>
        </Styled.LowerGrid>
        {removeTask.isError && <ErrorBanner>{messageOf(removeTask.error)}</ErrorBanner>}
        <ConfirmDialog {...dialogProps} />
      </Dialog.Root>
    </BaseLayout>
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
    <Styled.Composer
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="field grow">
        <label>무엇을 만들거나 해결할까요?</label>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 컴포넌트 추출"
          required
        />
      </div>
      <Styled.PriorityField>
        <legend>우선순위</legend>
        <Styled.PriorityPicker>
          {(Object.entries(PRIORITIES) as Array<[NonNullable<Task["priority"]>, string]>).map(
            ([value, label]) => (
              <button
                type="button"
                className={priority === value ? "selected" : ""}
                key={value}
                onClick={() => setPriority(value)}
              >
                <Styled.PriorityChoiceDot $priority={value} />
                {label}
              </button>
            ),
          )}
        </Styled.PriorityPicker>
      </Styled.PriorityField>
      <Styled.ResultField className="field grow">
        <label>원하는 결과 · 선택 사항</label>
        <Input
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
      </Styled.ResultField>
      <Styled.DialogActions>
        <Dialog.Close asChild>
          <Button $variant="secondary" type="button">
            취소
          </Button>
        </Dialog.Close>
        <Button $variant="primary" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? "만드는 중..." : "작업 만들기"}
        </Button>
      </Styled.DialogActions>
      {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
    </Styled.Composer>
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
    <Styled.TaskSection className="panel" $status={status}>
      <div className="section-heading compact">
        <h2>
          <span>{STATUS[status].icon}</span> {title ?? STATUS[status].label}
        </h2>
        <span className="count">{tasks.length}</span>
      </div>
      <Styled.TaskList>
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
      </Styled.TaskList>
    </Styled.TaskSection>
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
