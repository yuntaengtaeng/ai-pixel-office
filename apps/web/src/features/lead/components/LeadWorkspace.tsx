import styled from "styled-components";
import type { Agent, Project, Task } from "@ai-pixel-office/domain/entities";
import { useLeadConversation, useLeadRefresh } from "../hooks/useLeadConversation.ts";
import { delegatedTasks, leadPoseOf } from "../utils/leadView.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { josa } from "../../../shared/lib/korean.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { LeadComposer } from "./LeadComposer.tsx";
import { LeadDelegatedPanel } from "./LeadDelegatedPanel.tsx";
import { LeadMessageList } from "./LeadMessageList.tsx";
import { LeadSlime } from "./LeadSlime.tsx";

const Styled = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;
    @media ${({ theme }) => theme.mediaQuery.lg} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  Conversation: styled.section`
    max-width: 820px;
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Intro: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.space.x4};
    align-items: center;
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surface};
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.secondary};
      line-height: 1.6;
    }
  `,
  Composer: styled.div`
    position: sticky;
    bottom: ${({ theme }) => theme.space.x4};
  `,
};

/** 프로젝트 화면의 팀장 탭 (대화, 계획서 결재, 맡긴 기안과 보고) */
export function LeadWorkspace({
  project,
  agents,
  tasks,
}: {
  project: Project;
  agents: Agent[];
  /** 이 프로젝트의 기안서 */
  tasks: Task[];
}) {
  const conversation = useLeadConversation(project.id);
  const refresh = useLeadRefresh(project.id, project.workspaceId);
  if (conversation.isError) return <ErrorBanner>{messageOf(conversation.error)}</ErrorBanner>;
  const data = conversation.data;
  const pose = data ? leadPoseOf(data) : "idle";
  const colleagueNames = agents.map((agent) => agent.name).join(" · ");

  return (
    <Styled.Layout>
      <Styled.Conversation>
        <Styled.Intro>
          <LeadSlime pose={pose} size={64} breathing />
          <p>
            {project.name}의 팀장이에요. 원하는 결과를 말해 주시면 동료들에게 나눠 맡길 계획서를
            올릴게요.
            {colleagueNames && ` 지금 ${colleagueNames}${josa(colleagueNames, "이/가")} 있어요.`}
          </p>
        </Styled.Intro>
        {data && (
          <LeadMessageList
            messages={data.messages.filter((message) => message.role !== "report")}
            plans={data.plans}
            agents={agents}
            tasks={tasks}
            onPlanDecided={refresh}
          />
        )}
        <Styled.Composer>
          <LeadComposer
            projectId={project.id}
            replying={data?.replying ?? false}
            onSent={refresh}
          />
        </Styled.Composer>
      </Styled.Conversation>
      <LeadDelegatedPanel
        tasks={delegatedTasks(tasks, data?.plans ?? [])}
        reports={(data?.messages ?? []).filter((message) => message.role === "report")}
        agents={agents}
      />
    </Styled.Layout>
  );
}
