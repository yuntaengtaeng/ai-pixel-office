import type { Agent, KnowledgeDocument, Skill } from "@ai-pixel-office/domain/entities";
import type { TaskExecutionContext } from "../../api.ts";
import styled from "styled-components";

const Styled = {
  Panel: styled.details`
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${({ theme }) => theme.space.x2};
      padding: ${({ theme }) => theme.space.x3};
      cursor: pointer;
      list-style: none;
    }

    > summary::-webkit-details-marker {
      display: none;
    }
    > summary::after {
      content: "+";
      color: ${({ theme }) => theme.colors.text.positive};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
    &[open] > summary::after {
      content: "−";
    }
  `,
  Summary: styled.span`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  Rows: styled.div`
    display: grid;
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  `,
  Row: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

    > div {
      display: grid;
      min-width: 0;
      gap: ${({ theme }) => theme.space.x1};
    }
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
    small {
      overflow: hidden;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    > span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
    button {
      padding: 0;
      border: 0;
      background: transparent;
      color: ${({ theme }) => theme.colors.text.positive};
      font: inherit;
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      cursor: pointer;
    }
  `,
  PathRow: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    padding: ${({ theme }) => theme.space.x3};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
    small {
      overflow: hidden;
      color: ${({ theme }) => theme.colors.text.muted};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  Message: styled.small`
    display: block;
    padding: ${({ theme }) => theme.space.x3};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  `,
  ReferenceRow: styled.div`
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};

    div {
      display: grid;
      min-width: 0;
      gap: ${({ theme }) => theme.space.x1};
    }
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
    button {
      padding: 0;
      border: 0;
      background: transparent;
      color: ${({ theme }) => theme.colors.text.positive};
      font: inherit;
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      cursor: pointer;
    }
  `,
};

export function ExecutionContextPanel({
  contexts,
  agents,
  skills,
  loading,
  error,
  referenceDocuments,
  usage,
  onManageReferences,
}: {
  contexts: TaskExecutionContext[];
  agents: Agent[];
  skills: Skill[];
  loading: boolean;
  error?: string;
  referenceDocuments: KnowledgeDocument[];
  usage?: { inputTokens?: number; outputTokens?: number };
  onManageReferences: () => void;
}) {
  const instructionFileCount = new Set(contexts.flatMap((context) => context.instructionFiles))
    .size;
  const projectSkillCount = new Set(
    contexts.flatMap((context) => context.projectSkills.map((skill) => skill.path)),
  ).size;
  const agentSkillCount = new Set(
    contexts.flatMap((context) => {
      const agent = agents.find((candidate) => candidate.id === context.agentId);
      return skills.filter((skill) => agent?.skillIds.includes(skill.id)).map((skill) => skill.id);
    }),
  ).size;
  const workingDirectory = contexts[0]?.workingDirectory;
  const skillCount = projectSkillCount + agentSkillCount;
  const tokenCount = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  const compactSummary = loading
    ? "환경 확인 중"
    : `${workingDirectory ? fileName(workingDirectory) : "폴더 미설정"} · 스킬 ${skillCount}개${tokenCount ? ` · 토큰 ${tokenCount.toLocaleString()}` : ""}`;

  return (
    <>
      <Styled.ReferenceRow>
        <div>
          <strong>참고 문서</strong>
          <small>
            {referenceDocuments.length
              ? `${referenceDocuments.length}개만 전달`
              : "선택한 문서만 전달"}
          </small>
        </div>
        <button type="button" onClick={onManageReferences}>
          관리
        </button>
      </Styled.ReferenceRow>
      <Styled.Panel>
        <summary>
          <Styled.Summary>
            <strong>실행 정보</strong>
            <small>{compactSummary}</small>
          </Styled.Summary>
        </summary>
        <Styled.Rows>
          {error ? (
            <Styled.Message>{error}</Styled.Message>
          ) : !loading && contexts.length === 0 ? (
            <Styled.Message>담당자를 선택하면 실행 환경을 확인할 수 있어요.</Styled.Message>
          ) : (
            <>
              <WorkingDirectoryRow path={workingDirectory} />
              <SummaryRow
                label="프로젝트 지침"
                detail={instructionFileCount ? `${instructionFileCount}개 파일` : "설정된 지침 없음"}
                value={String(instructionFileCount)}
              />
              <SummaryRow
                label="사용 스킬"
                detail={skillCount ? `${skillCount}개 적용` : "기본 업무 능력"}
                value={String(skillCount)}
              />
            </>
          )}
          {usage && (
            <>
              <SummaryRow
                label="입력 토큰"
                detail="최근 실행 기준"
                value={usage.inputTokens?.toLocaleString() ?? "-"}
              />
              <SummaryRow
                label="출력 토큰"
                detail="최근 실행 기준"
                value={usage.outputTokens?.toLocaleString() ?? "-"}
              />
            </>
          )}
        </Styled.Rows>
      </Styled.Panel>
    </>
  );
}

function SummaryRow({ label, detail, value }: { label: string; detail: string; value: string }) {
  return (
    <Styled.Row>
      <div>
        <strong>{label}</strong>
        <small title={detail}>{detail}</small>
      </div>
      <span title={value}>{value}</span>
    </Styled.Row>
  );
}

function WorkingDirectoryRow({ path }: { path?: string }) {
  return (
    <Styled.PathRow>
      <strong>작업 폴더</strong>
      <small title={path}>{path ?? "확인 중"}</small>
    </Styled.PathRow>
  );
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}
