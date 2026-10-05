import type {
  AgentRun,
  QueuedRequest,
  KnowledgeDocument,
  MessageAttachment,
  RunProgressEvent,
  Task,
  TaskReview,
} from "@ai-pixel-office/domain/entities";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { ApiRequestError, post, request } from "../../shared/api/client.ts";
import { requestTitle } from "./utils/requestTitle.ts";

/** 결재가 프로젝트 폴더에 먼저 반영된 변경과 겹쳐 반영되지 않음 */
export class WorkspaceConflictError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkspaceConflictError";
  }
}

export type WorkspaceFileChange = { status: "added" | "modified" | "deleted"; path: string };

/** 기안서 작업 공간의 바뀐 파일 (작업 공간에서 실행하지 않으면 isolated: false) */
export type RequestWorkspaceSummary =
  | { isolated: false }
  | { isolated: true; inside: WorkspaceFileChange[]; outside: WorkspaceFileChange[] };

export type TaskDetail = Task & {
  runs: AgentRun[];
  reviews: TaskReview[];
  progress: RunProgressEvent[];
  progressByRun: Record<string, RunProgressEvent[]>;
  attachmentsByRun: Record<string, Array<Omit<MessageAttachment, "storagePath">>>;
};

export type UploadedAttachment = Pick<
  MessageAttachment,
  "id" | "name" | "mediaType" | "size" | "source"
>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export type TaskExecutionContext = {
  agentId: string;
  agentName: string;
  runtime: AgentRun["runtime"];
  workingDirectory: string;
  instructionFiles: string[];
  projectSkills: Array<{ name: string; path: string }>;
};

export const taskApi = {
  list: (workspaceId: string, origin?: Task["origin"]) =>
    request<Task[]>(
      `/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}${origin ? `&origin=${origin}` : ""}`,
    ),
  create: (input: {
    workspaceId: string;
    title: string;
    description?: string;
    assigneeAgentId?: string;
    priority?: "low" | "medium" | "high";
    projectId?: string;
    origin?: Task["origin"];
  }) => post<Task>("/api/tasks", input),
  get: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  executionContexts: (id: string) =>
    request<TaskExecutionContext[]>(`/api/tasks/${id}/execution-context`),
  update: (
    id: string,
    input: Partial<
      Pick<Task, "title" | "description" | "assigneeAgentId" | "priority" | "projectId">
    >,
  ) => request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  run: (id: string, attachmentIds: string[] = []) =>
    post<AgentRun | QueuedRequest>(`/api/tasks/${id}/run`, { attachmentIds }),
  createDocument: (id: string) => post<KnowledgeDocument>(`/api/tasks/${id}/document`, {}),
  retry: (id: string) => post<AgentRun>(`/api/tasks/${id}/retry`, {}),
  continue: (id: string) => post<AgentRun>(`/api/tasks/${id}/continue`, {}),
  extendSession: (id: string) => post<AgentRun>(`/api/tasks/${id}/extend-session`, {}),
  resumeSession: (id: string, sourceRunId: string, message: string, attachmentIds: string[] = []) =>
    post<AgentRun>(`/api/tasks/${id}/resume`, { sourceRunId, message, attachmentIds }),
  /** 결재 (프로젝트 폴더에 먼저 반영된 변경과 겹치면 WorkspaceConflictError) */
  approve: async (id: string) => {
    try {
      return await post<Task>(`/api/tasks/${id}/approve`, {});
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "WORKSPACE_CONFLICT")
        throw new WorkspaceConflictError(error.message, { cause: error });
      throw error;
    }
  },
  /** 결재가 겹친 기안서를 프로젝트 폴더의 지금 상태에 맞춰 다시 얹음 */
  realign: (id: string) => post<Task | AgentRun>(`/api/tasks/${id}/realign`, {}),
  workspace: (id: string) => request<RequestWorkspaceSummary>(`/api/tasks/${id}/workspace`),
  /** 결재 전 작업 공간에서 파일 하나가 바뀐 내용 (unified diff) */
  workspaceDiff: (id: string, path: string) =>
    request<{ diff: string }>(
      `/api/tasks/${id}/workspace/diff?path=${encodeURIComponent(path)}`,
    ),
  /** 새 요청: 기안서를 만들고 첨부를 올린 뒤 바로 시작 */
  startRequest: async (input: {
    workspaceId: string;
    message: string;
    projectId?: string;
    agentId: string;
    files?: File[];
  }) => {
    const task = await taskApi.create({
      workspaceId: input.workspaceId,
      title: requestTitle(input.message),
      description: input.message,
      assigneeAgentId: input.agentId,
      projectId: input.projectId,
    });
    const attachments = input.files?.length
      ? await taskApi.uploadAttachments(input.workspaceId, task.id, input.files)
      : [];
    await taskApi.run(
      task.id,
      attachments.map((attachment) => attachment.id),
    );
    return task;
  },
  requestChanges: (id: string, feedback: string, attachmentIds: string[] = []) =>
    post<AgentRun>(`/api/tasks/${id}/request-changes`, { feedback, attachmentIds }),
  sendMessage: (id: string, message: string, attachmentIds: string[] = []) =>
    post<AgentRun>(`/api/tasks/${id}/messages`, { message, attachmentIds }),
  cancelRun: (id: string) => post<AgentRun>(`/api/runs/${id}/cancel`, {}),
  resolveApproval: (runId: string, requestId: string, decision: ApprovalDecision) =>
    post<AgentRun>(`/api/runs/${runId}/approvals/${requestId}`, { decision }),
  /** 전송 직전 File을 base64로 인코딩해 앱 저장소에 올리고, 이후 run/message 호출은 반환된 id만 참조한다. */
  uploadAttachments: (
    workspaceId: string,
    taskId: string,
    files: File[],
  ): Promise<UploadedAttachment[]> => {
    if (files.length > 10) throw new Error("첨부 파일은 한 번에 10개까지 보낼 수 있습니다.");
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      throw new Error("첨부 파일 전체 크기는 50MB 이하로 선택해 주세요.");
    }
    return (async () => {
      const uploaded: UploadedAttachment[] = [];
      try {
        for (const file of files) {
          uploaded.push(
            await post<UploadedAttachment>("/api/attachments", {
              workspaceId,
              taskId,
              name: file.name,
              mediaType: file.type || "application/octet-stream",
              source:
                (file as File & { __pixelOfficeAttachmentSource?: "clipboard-image" })
                  .__pixelOfficeAttachmentSource ?? "file",
              data: await fileToBase64(file),
            }),
          );
        }
        return uploaded;
      } catch (error) {
        await Promise.allSettled(
          uploaded.map((attachment) =>
            request<void>(`/api/attachments/${attachment.id}`, { method: "DELETE" }),
          ),
        );
        throw error;
      }
    })();
  },
};
