import type { AgentModel, LeadMessage, LeadPlan } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

/** 프로젝트 팀장 대화 (말, 계획서, 답을 쓰는 중인지) */
export type LeadConversation = {
  messages: LeadMessage[];
  plans: LeadPlan[];
  replying: boolean;
  runtime: AgentModel;
};

export const leadApi = {
  conversation: (projectId: string) => request<LeadConversation>(`/api/projects/${projectId}/lead`),
  send: (projectId: string, message: string) =>
    post<LeadMessage>(`/api/projects/${projectId}/lead/messages`, { message }),
  stop: (projectId: string) => post<void>(`/api/projects/${projectId}/lead/stop`, {}),
  discard: (planId: string) => post<LeadPlan>(`/api/lead-plans/${planId}/discard`, {}),
  approve: (planId: string) => post<LeadPlan>(`/api/lead-plans/${planId}/approve`, {}),
  reject: (planId: string, feedback: string) =>
    post<LeadPlan>(`/api/lead-plans/${planId}/reject`, { feedback }),
};
