import { taskApi } from "../tasks/api.ts";

export const chatApi = {
  listRecent: (workspaceId: string) => taskApi.list(workspaceId, "chat"),
  start: async (input: {
    workspaceId: string;
    agentId: string;
    message: string;
    projectId?: string;
    files?: File[];
  }) => {
    const task = await taskApi.create({
      workspaceId: input.workspaceId,
      title: input.message.slice(0, 60),
      description: input.message,
      assigneeAgentId: input.agentId,
      projectId: input.projectId,
      origin: "chat",
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
  sendMessage: async (workspaceId: string, taskId: string, message: string, files: File[] = []) => {
    const attachments = files.length
      ? await taskApi.uploadAttachments(workspaceId, taskId, files)
      : [];
    return taskApi.sendMessage(
      taskId,
      message,
      attachments.map((attachment) => attachment.id),
    );
  },
};
