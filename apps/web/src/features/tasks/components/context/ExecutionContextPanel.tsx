import type { Agent, Skill } from "@ai-pixel-office/domain/entities";
import type { ReactNode } from "react";
import type { TaskExecutionContext } from "../../api.ts";

import styled from "styled-components";

const Styled = {
  ExecutionContext: styled.details`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};

    > small,
    > p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      line-height: 1.5;
    }
  `,
  ExecutionContextSummary: styled.summary`
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker {
      display: none;
    }
  `,
  ExecutionContextHeading: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    span {
      color: ${({ theme }) => theme.colors.text.positive};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  ExecutionContextContent: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding-top: ${({ theme }) => theme.space.x2};
  `,
  ExecutionContextItem: styled.details`
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > summary {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      gap: ${({ theme }) => theme.space.x2};
      align-items: center;
      padding: ${({ theme }) => theme.space.x2};
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }

      > span {
        width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
        color: ${({ theme }) => theme.colors.text.positive};
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: ${({ theme }) => theme.space.x2};
      }

      strong {
        font-size: ${({ theme }) => theme.typography.fontSize.micro};
      }

      small {
        color: ${({ theme }) => theme.colors.text.positive};
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }
    }
  `,
  ExecutionContextBody: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x2};
    border-top: 1px solid ${({ theme }) => theme.colors.border.positive};

    > code {
      overflow: hidden;
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  ExecutionContextGroup: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    > b {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }

    > div {
      display: flex;
      flex-wrap: wrap;
      gap: ${({ theme }) => theme.space.x1};
    }

    span {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x1}`};
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    small {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  ExecutionContextError: styled.small`
    color: ${({ theme }) => theme.colors.text.negative};
  `,
};

export function ExecutionContextPanel({
  contexts,
  agents,
  skills,
  loading,
  error,
  referenceDocuments,
}: {
  contexts: TaskExecutionContext[];
  agents: Agent[];
  skills: Skill[];
  loading: boolean;
  error?: string;
  referenceDocuments: ReactNode;
}) {
  return (
    <Styled.ExecutionContext>
      <Styled.ExecutionContextSummary>
        <Styled.ExecutionContextHeading>
          <strong>실행 컨텍스트</strong>
          <span>펼쳐 보기</span>
        </Styled.ExecutionContextHeading>
      </Styled.ExecutionContextSummary>
      <Styled.ExecutionContextContent>
        {loading ? (
          <small>프로젝트 지침을 확인하는 중입니다.</small>
        ) : error ? (
          <Styled.ExecutionContextError>{error}</Styled.ExecutionContextError>
        ) : contexts.length === 0 ? (
          <small>담당자를 정하면 실행 컨텍스트를 확인할 수 있습니다.</small>
        ) : (
          contexts.map((context) => {
            const contextAgent = agents.find((candidate) => candidate.id === context.agentId);
            const mappedSkills = skills.filter((skill) =>
              contextAgent?.skillIds.includes(skill.id),
            );
            return (
              <Styled.ExecutionContextItem key={context.workflowStepId ?? context.agentId}>
                <summary>
                  <span>{context.position === undefined ? "1" : context.position + 1}</span>
                  <div>
                    <strong>{context.agentName}</strong>
                    <small>{context.runtime.toUpperCase()}</small>
                  </div>
                </summary>
                <Styled.ExecutionContextBody>
                  <code title={context.workingDirectory}>{context.workingDirectory}</code>
                  <ContextGroup label={`${context.runtime.toUpperCase()} 프로젝트 지침`}>
                    {context.instructionFiles.length > 0 ? (
                      context.instructionFiles.map((path) => (
                        <span title={path} key={path}>
                          {fileName(path)} 감지됨
                        </span>
                      ))
                    ) : (
                      <small>설정된 프로젝트 지침이 없습니다.</small>
                    )}
                  </ContextGroup>
                  <ContextGroup label="프로젝트 스킬">
                    {context.projectSkills.length > 0 ? (
                      context.projectSkills.map((skill) => (
                        <span title={skill.path} key={skill.path}>
                          {skill.name}
                        </span>
                      ))
                    ) : (
                      <small>감지된 프로젝트 스킬이 없습니다.</small>
                    )}
                  </ContextGroup>
                  <ContextGroup label="동료에게 매핑된 스킬">
                    {mappedSkills.length > 0 ? (
                      mappedSkills.map((skill) => <span key={skill.id}>{skill.name}</span>)
                    ) : (
                      <small>기본 업무 능력으로 실행합니다.</small>
                    )}
                  </ContextGroup>
                </Styled.ExecutionContextBody>
              </Styled.ExecutionContextItem>
            );
          })
        )}
        {referenceDocuments}
        <p>파일 존재 여부만 표시하며, 실제 해석과 적용은 각 런타임이 담당합니다.</p>
      </Styled.ExecutionContextContent>
    </Styled.ExecutionContext>
  );
}

function ContextGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Styled.ExecutionContextGroup>
      <b>{label}</b>
      <div>{children}</div>
    </Styled.ExecutionContextGroup>
  );
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}
