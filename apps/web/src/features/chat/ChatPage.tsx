import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mediaQuery } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import styled from "styled-components";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { agentApi } from "../agents/api.ts";
import { activityApi } from "../activity/api.ts";
import { projectApi } from "../projects/api.ts";
import { taskApi } from "../tasks/api.ts";
import { chatApi } from "./api.ts";
import { ChatList } from "./components/ChatList.tsx";
import { ChatThread } from "./components/ChatThread.tsx";
import { NewChatComposer } from "./components/NewChatComposer.tsx";
import { recentProjectId, rememberProject } from "../../shared/lib/recentProject.ts";

const Styled = {
  Grid: styled.div`
    display: grid;
    grid-template-columns: minmax(220px, 0.3fr) minmax(0, 0.7fr);
    gap: ${({ theme }) => theme.space.x4};
    height: calc(100vh - 260px);
    min-height: 420px;

    > * {
      min-height: 0;
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
      height: auto;
    }
  `,
};

export function ChatPage({ workspace }: { workspace: Workspace }) {
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();

  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const chats = useQuery({
    queryKey: ["tasks", workspace.id, "chat"],
    queryFn: () => chatApi.listRecent(workspace.id),
  });
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const activities = useQuery({
    queryKey: ["activities", workspace.id],
    queryFn: () => activityApi.list(workspace.id),
    refetchInterval: taskId ? 1500 : false,
  });
  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => taskApi.get(taskId as string),
    enabled: Boolean(taskId),
    refetchInterval: (query) =>
      ["working", "needs_input"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
  };

  const startChat = useMutation({
    mutationFn: (input: { agentId: string; message: string; projectId?: string; files?: File[] }) =>
      chatApi.start({ workspaceId: workspace.id, ...input }),
    onSuccess: (created, input) => {
      rememberProject(workspace.id, input.projectId);
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/chat/${created.id}`);
    },
  });
  const sendMessage = useMutation({
    mutationFn: (input: { message: string; files?: File[] }) =>
      chatApi.sendMessage(workspace.id, taskId as string, input.message, input.files),
    onSuccess: invalidate,
  });
  const retry = useMutation({
    mutationFn: () => taskApi.retry(taskId as string),
    onSuccess: invalidate,
  });
  const continueSession = useMutation({
    mutationFn: () => taskApi.continue(taskId as string),
    onSuccess: invalidate,
  });
  const extendSession = useMutation({
    mutationFn: () => taskApi.extendSession(taskId as string),
    onSuccess: invalidate,
  });
  const endChat = useMutation({
    mutationFn: () => taskApi.approve(taskId as string),
    onSuccess: invalidate,
  });
  const resumeSession = useMutation({
    mutationFn: async (input: { message: string; files?: File[] }) => {
      const sourceRun = task.data?.runs.find(
        (run) =>
          Boolean(run.runtimeThreadId) && ["completed", "cancelled"].includes(run.status),
      );
      if (!sourceRun) throw new Error("다시 열 수 있는 이전 세션이 없습니다.");
      const attachments = input.files?.length
        ? await taskApi.uploadAttachments(workspace.id, taskId as string, input.files)
        : [];
      return taskApi.resumeSession(
        taskId as string,
        sourceRun.id,
        input.message,
        attachments.map((attachment) => attachment.id),
      );
    },
    onSuccess: invalidate,
  });
  const deleteChat = useMutation({
    mutationFn: () => taskApi.remove(taskId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate("/chat");
    },
  });
  const resolveApproval = useMutation({
    mutationFn: ({
      runId,
      requestId,
      decision,
    }: {
      runId: string;
      requestId: string;
      decision: ApprovalDecision;
    }) => taskApi.resolveApproval(runId, requestId, decision),
    onSuccess: invalidate,
  });

  if (agents.isPending || chats.isPending || projects.isPending)
    return <FullScreenMessage>대화를 준비하는 중...</FullScreenMessage>;
  if (agents.isError || projects.isError)
    return <FullScreenMessage error>{messageOf(agents.error ?? projects.error)}</FullScreenMessage>;

  const activeAgent = agents.data?.find((agent) => agent.id === task.data?.assigneeAgentId);
  const latestRun = task.data?.runs[0];
  const runActivities = (activities.data ?? []).filter((activity) => activity.runId === latestRun?.id);
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
  const resumableRun = task.data?.runs.find(
    (run) => Boolean(run.runtimeThreadId) && ["completed", "cancelled"].includes(run.status),
  );
  const canResumeSession =
    Boolean(resumableRun) && ["done", "todo"].includes(task.data?.status ?? "");
  const projectsWithFolders = (projects.data ?? []).filter((project) => project.path);
  const recentProject = recentProjectId(workspace.id);
  const latestProject = projectsWithFolders.reduce<
    (typeof projectsWithFolders)[number] | undefined
  >(
    (latest, project) => (!latest || project.createdAt > latest.createdAt ? project : latest),
    undefined,
  );
  let initialProjectId: string | undefined;
  if (recentProject !== "") {
    initialProjectId = projectsWithFolders.some((project) => project.id === recentProject)
      ? (recentProject ?? undefined)
      : latestProject?.id;
  }

  return (
    <BaseLayout>
      <PageHeader eyebrow="동료와 대화하기" title="메신저" />
      <Styled.Grid>
        <ChatList
          chats={chats.data ?? []}
          agents={agents.data ?? []}
          activeTaskId={taskId}
          onSelect={(id) => navigate(`/chat/${id}`)}
          onNewChat={() => navigate("/chat")}
        />
        {taskId ? (
          task.isPending ? (
            <FullScreenMessage>대화를 불러오는 중...</FullScreenMessage>
          ) : task.isError || !task.data ? (
            <ErrorBanner>{messageOf(task.error)}</ErrorBanner>
          ) : (
            <ChatThread
              task={task.data}
              agent={activeAgent}
              onSendMessage={(message, files) => sendMessage.mutateAsync({ message, files })}
              sending={sendMessage.isPending}
              sendError={sendMessage.error ?? resumeSession.error}
              onRetry={() => retry.mutate()}
              onContinueSession={() => continueSession.mutate()}
              onExtendSession={() => extendSession.mutate()}
              sessionActionPending={continueSession.isPending || extendSession.isPending}
              pendingApproval={pendingApproval}
              approvalPending={resolveApproval.isPending}
              onApprovalDecision={(decision) => {
                if (!latestRun || !pendingApproval) return;
                resolveApproval.mutate({
                  runId: latestRun.id,
                  requestId: String(pendingApproval.metadata?.requestId),
                  decision,
                });
              }}
              canResumeSession={canResumeSession}
              onResumeSession={(message, files) => resumeSession.mutateAsync({ message, files })}
              resumePending={resumeSession.isPending}
              onEndChat={() => endChat.mutate()}
              endPending={endChat.isPending}
              onDelete={async () => {
                if (
                  await confirm({
                    title: "이 대화를 삭제할까요?",
                    description: `'${task.data.title}'의 실행 기록과 결과도 함께 삭제됩니다`,
                    confirmLabel: "대화 삭제",
                    tone: "danger",
                  })
                )
                  deleteChat.mutate();
              }}
              deletePending={deleteChat.isPending}
            />
          )
        ) : (
          <NewChatComposer
            agents={agents.data ?? []}
            projects={projectsWithFolders}
            initialProjectId={initialProjectId}
            defaultAgentId={workspace.defaultAgentId}
            onStart={(input) => startChat.mutateAsync(input)}
            pending={startChat.isPending}
            error={startChat.error}
          />
        )}
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
