import { taskApi } from "../tasks/api.ts";

export const chatApi = {
  listRecent: (workspaceId: string) => taskApi.list(workspaceId, "chat"),
  start: async (input: { workspaceId: string; agentId: string; message: string }) => {
    const task = await taskApi.create({
      workspaceId: input.workspaceId,
      title: input.message.slice(0, 60),
      description: input.message,
      assigneeAgentId: input.agentId,
      origin: "chat",
    });
    await taskApi.run(task.id);
    return task;
  },
  sendMessage: (taskId: string, message: string) => taskApi.sendMessage(taskId, message),
};
