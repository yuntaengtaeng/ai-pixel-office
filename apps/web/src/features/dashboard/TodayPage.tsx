import { colors, mediaQuery } from "@ai-pixel-office/design-system";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  Button,
  CloseIcon,
  Dialog,
  Input,
  Kicker,
  Panel,
  Select,
  useDialogIds,
} from "@ai-pixel-office/design-system";
import type { ActivityLog, Task, TaskStatus, Workspace } from "@ai-pixel-office/domain/entities";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { RUNTIME, STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { resolveTaskHref } from "../../shared/lib/taskRouting.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { LiveBadge, OfficeCard, OfficeLoading } from "../office/OfficeCard.tsx";
import { TaskComposer } from "./components/TaskComposer.tsx";
import { TaskSection } from "./components/TaskSection.tsx";

const PixelOffice = lazy(async () => {
  const module = await import("../office/PixelOffice.tsx");
  return { default: module.PixelOffice };
});

const Styled = {
  Onboarding: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x6};
    text-align: center;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    justify-items: center;

    h2 {
      margin: 0;
    }

    p {
      margin: 0;
      max-width: 420px;
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
  DialogContent: styled(Dialog)`
    .dialog-content {
      width: min(680px, calc(100vw - 28px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      background: ${({ theme }) => theme.colors.background.surfaceRaised};

      > header {
        display: flex;
        justify-content: space-between;
        gap: ${({ theme }) => theme.space.x5};
        margin-bottom: ${({ theme }) => theme.space.x5};
        padding-bottom: ${({ theme }) => theme.space.x4};
        border-bottom: 2px dashed ${({ theme }) => theme.colors.border.default};
      }

      h2 {
        margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x2}`};
        font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
      }

      header p {
        margin: 0;
        max-width: 540px;
        color: ${({ theme }) => theme.colors.text.muted};
        font-size: ${({ theme }) => theme.typography.fontSize.sm};
        line-height: 1.55;
      }
    }
  `,
  DialogClose: styled.button`
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
    gap: ${({ theme }) => theme.space.x2};
  `,
  HeadingMeta: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
  `,
  RuntimeLegend: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
  `,
  RuntimeLegendChip: styled.span`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x1};
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
    gap: ${({ theme }) => theme.space.x3};
    align-items: center;
    margin-bottom: ${({ theme }) => theme.space.x4};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  Search: styled.label`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    min-height: 38px;
    padding: ${({ theme }) => `0 ${theme.space.x3}`};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.muted};

    input {
      min-width: 0;
      padding: ${({ theme }) => theme.space.x2};
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
    gap: ${({ theme }) => theme.space.x1};
    overflow-x: auto;
    padding: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x1}`};

    button {
      flex: 0 0 auto;
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
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
      margin-left: ${({ theme }) => theme.space.x1};
      font-family: monospace;
    }
  `,
  TodayGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x4};

    @media ${mediaQuery.xl} {
      grid-template-columns: repeat(2, 1fr);
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  LowerGrid: styled.div`
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: ${({ theme }) => theme.space.x5};
    margin-top: ${({ theme }) => theme.space.x5};

    > :only-child {
      grid-column: 1 / -1;
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ActivityPanel: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x4};

    ${SectionHeading} select {
      min-width: 0;
      flex: 1 1 auto;
      margin-left: ${({ theme }) => theme.space.x3};
      padding: ${({ theme }) => theme.space.x1} ${({ theme }) => theme.space.x2};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
      font-family: inherit;
    }

    ${SectionHeading} h2 {
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
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x1}`};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

    div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
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
    margin-top: ${({ theme }) => theme.space.x1};
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
    margin-top: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.shadow.default};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
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
  const { titleId, descriptionId } = useDialogIds();
  return (
    <BaseLayout>
      <>
        <PageHeader
          eyebrow={new Intl.DateTimeFormat("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          }).format(new Date())}
          title="오늘의 오피스"
          action={
            <Button $variant="primary" onClick={() => setShowComposer(true)}>
              + 새 작업
            </Button>
          }
        />
        <Styled.DialogContent
          open={showComposer}
          onOpenChange={setShowComposer}
          titleId={titleId}
          descriptionId={descriptionId}
        >
          <header>
            <div>
              <Kicker>NEW TASK</Kicker>
              <h2 id={titleId}>새 작업 만들기</h2>
              <p id={descriptionId}>
                할 일을 먼저 만들고 다음 화면에서 프로젝트와 담당 에이전트를 정할 수 있어요.
              </p>
            </div>
            <Styled.DialogClose
              type="button"
              aria-label="닫기"
              title="닫기"
              onClick={() => setShowComposer(false)}
            >
              <CloseIcon size={16} />
            </Styled.DialogClose>
          </header>
          <TaskComposer workspace={workspace} onDone={() => setShowComposer(false)} />
        </Styled.DialogContent>
        {(agents.isError || tasks.isError) && (
          <ErrorBanner>{messageOf(agents.error ?? tasks.error)}</ErrorBanner>
        )}
        <OfficeCard>
          <SectionHeading>
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
              <LiveBadge>
                <Styled.OnlineDot /> 실시간
              </LiveBadge>
            </Styled.HeadingMeta>
          </SectionHeading>
          <Suspense fallback={<OfficeLoading>픽셀 오피스를 준비하는 중...</OfficeLoading>}>
            <PixelOffice
              agents={agentList}
              tasks={taskList}
              onOpenTask={(taskId) => {
                const task = taskList.find((candidate) => candidate.id === taskId);
                navigate(task ? resolveTaskHref(task) : `/tasks/${taskId}`);
              }}
              onQuickAssign={(agentId, title, description) =>
                officeQuickAssign.mutate({ agentId, title, description })
              }
            />
          </Suspense>
          {officeQuickAssign.isError && (
            <ErrorBanner>{messageOf(officeQuickAssign.error)}</ErrorBanner>
          )}
        </OfficeCard>
        {taskList.length === 0 ? (
          <Styled.Onboarding>
            <h2>아직 작업이 없어요</h2>
            <p>위쪽 "+ 새 작업" 버튼으로 첫 작업을 만들면, 여기서 진행 상황을 확인할 수 있어요.</p>
            <Button $variant="primary" onClick={() => setShowComposer(true)}>
              + 첫 작업 만들기
            </Button>
          </Styled.Onboarding>
        ) : (
          <>
            <Styled.Toolbar aria-label="작업 검색과 상태 필터">
              <Styled.Search>
                <span>⌕</span>
                <Input
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="작업 제목이나 설명 검색"
                />
                {taskSearch && (
                  <button
                    type="button"
                    onClick={() => setTaskSearch("")}
                    aria-label="검색어 지우기"
                  >
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
              {(
                [
                  "todo",
                  "working",
                  "needs_review",
                  "needs_input",
                  "blocked",
                  "failed",
                ] as TaskStatus[]
              )
                .filter((status) => statusFilter === "all" || statusFilter === status)
                .map((status) => (
                  <TaskSection
                    key={status}
                    status={status}
                    tasks={visibleTasks.filter((task) => task.status === status)}
                    agents={agentList}
                    onDelete={deleteTask}
                    deletingId={removeTask.isPending ? removeTask.variables : undefined}
                    onCreate={
                      status === "todo" && !taskSearch.trim()
                        ? () => setShowComposer(true)
                        : undefined
                    }
                  />
                ))}
            </Styled.TodayGrid>
          </>
        )}
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
          <Styled.ActivityPanel>
            <SectionHeading $compact>
              <h2>최근 활동</h2>
              <Select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value)}
                aria-label="활동 종류 필터"
              >
                <option value="all">전체 {activities.data?.length ?? 0}</option>
                <option value="task">작업</option>
                <option value="approval">승인</option>
                <option value="agent">에이전트</option>
              </Select>
            </SectionHeading>
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
      </>
    </BaseLayout>
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
