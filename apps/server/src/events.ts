import type { ServerResponse } from "node:http";

export type RealtimeEvent = {
  type:
    | "agent.status_changed"
    | "task.status_changed"
    | "task.result_updated"
    | "activity.created"
    | "approval.requested"
    | "run.progress"
    | "session.limit_warning"
    | "session.limit_reached";
  workspaceId: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export class EventBus {
  private readonly clients = new Map<string, Set<ServerResponse>>();

  subscribe(workspaceId: string, response: ServerResponse): () => void {
    const group = this.clients.get(workspaceId) ?? new Set<ServerResponse>();
    group.add(response);
    this.clients.set(workspaceId, group);
    response.write(`event: connected\ndata: ${JSON.stringify({ workspaceId })}\n\n`);
    return () => {
      group.delete(response);
      if (group.size === 0) this.clients.delete(workspaceId);
    };
  }

  publish(event: Omit<RealtimeEvent, "createdAt">): void {
    const message: RealtimeEvent = { ...event, createdAt: new Date().toISOString() };
    for (const response of this.clients.get(event.workspaceId) ?? []) {
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(message)}\n\n`);
    }
  }
}
