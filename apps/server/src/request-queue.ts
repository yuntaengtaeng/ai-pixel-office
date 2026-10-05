import {
  DomainError,
  ProjectBusyError,
  type ActivityLog,
  type AgentRun,
  type Task,
  type TaskStatus,
} from "@ai-pixel-office/domain";
import type { Repository } from "./repository/index.ts";

/** 이 상태로 바뀐 기안서는 프로젝트 폴더의 파일 수정 자리를 쥐고 있지 않음 */
const SLOT_RELEASING_STATUSES: readonly TaskStatus[] = ["done", "failed", "todo"];

/** 기안서가 바뀐 뒤 같은 프로젝트의 순서 대기를 깨워 볼지 */
export function releasesProjectSlot(task: Task): boolean {
  return SLOT_RELEASING_STATUSES.includes(task.status) && task.queuedBehind === undefined;
}

type QueueRepository = Pick<Repository, "queueTask" | "listQueuedTasks" | "listTaskActivities">;

/**
 * 순서 대기 (Git 저장소가 아닌 프로젝트 폴더를 다른 기안서가 쓰고 있으면 기다렸다가,
 * 자리가 비면 먼저 기다린 기안서부터 이어감)
 */
export class RequestQueue {
  private readonly repository: QueueRepository;
  private readonly start: (taskId: string, attachmentIds: string[]) => Promise<AgentRun>;
  private readonly publish: {
    task: (task: Task) => void;
    activity: (activity: ActivityLog) => void;
  };
  private readonly resuming = new Set<string>();

  constructor(dependencies: {
    repository: QueueRepository;
    /** 순서 대기 중인 기안서의 다음 run 시작 (자리가 아직 차 있으면 ProjectBusyError) */
    start: (taskId: string, attachmentIds: string[]) => Promise<AgentRun>;
    publish: { task: (task: Task) => void; activity: (activity: ActivityLog) => void };
  }) {
    this.repository = dependencies.repository;
    this.start = dependencies.start;
    this.publish = dependencies.publish;
  }

  /** 기안서를 순서 대기로 (시작할 때 붙인 첨부는 이어갈 때 다시 넘김) */
  async enqueue(task: Task, busy: ProjectBusyError, attachmentIds: string[] = []): Promise<Task> {
    if (task.queuedBehind !== undefined) return task;
    const queued = await this.repository.queueTask(task.id, busy.holderTitle, { attachmentIds });
    this.publish.task(queued.task);
    this.publish.activity(queued.activity);
    return queued.task;
  }

  /** 프로젝트에서 가장 먼저 기다린 기안서를 이어감 (자리가 아직 차 있으면 그대로 두고, 앞 기안을 기다리는 기안서는 건너뜀) */
  async resume(projectId: string): Promise<void> {
    if (this.resuming.has(projectId)) return;
    this.resuming.add(projectId);
    try {
      for (const next of await this.repository.listQueuedTasks(projectId)) {
        try {
          await this.start(next.id, this.attachmentIdsOf(next));
          return;
        } catch (error) {
          if (error instanceof ProjectBusyError) return;
          if (error instanceof DomainError && error.code === "WAITING_FOR_EARLIER_REQUESTS")
            continue;
          console.error(`Failed to resume a queued request in project ${projectId}`, error);
          return;
        }
      }
    } finally {
      this.resuming.delete(projectId);
    }
  }

  /** 순서 대기 중인 기안서가 시작할 때 붙인 첨부 (대기 중이 아니면 없음) */
  attachmentIdsOf(task: Task): string[] {
    if (task.queuedBehind === undefined) return [];
    const [latest] = this.repository
      .listTaskActivities(task.id, "request_queued")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const ids = latest?.metadata?.attachmentIds;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  }
}
