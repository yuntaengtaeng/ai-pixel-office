import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import type { Agent, Project } from "@ai-pixel-office/domain/entities";
import { Button, HelperText } from "@ai-pixel-office/design-system";
import { PERMISSIONS } from "../../../shared/config/presentation.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { MarkdownContent } from "../../../shared/ui/MarkdownContent.tsx";
import { skillApi } from "../api.ts";
import { SKILL_SOURCE_LABEL, skillRemovalBlocker } from "../utils/skillLibraryView.ts";

const Styled = {
  Panel: styled.section`
    display: grid;
    align-content: start;
    gap: ${({ theme }) => theme.space.x4};
    padding: ${({ theme }) => theme.space.x5};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surface};
  `,
  Name: styled.h2`
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
  Description: styled.p`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    line-height: 1.5;
  `,
  Facts: styled.dl`
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    dt {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
  Files: styled.ul`
    padding: ${({ theme }) => theme.space.x3};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: 1.7;
  `,
  Body: styled.div`
    max-height: 420px;
    overflow: auto;
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.radius.md};
  `,
};

/** 스킬 하나의 SKILL.md 내용, 파일, 출처와 삭제 */
export function SkillDetailPanel({
  skillId,
  usedBy,
  usedInProjects,
  onRemoved,
}: {
  skillId: string;
  usedBy: Agent[];
  /** 이 스킬을 쓰는 동료가 일한 프로젝트 */
  usedInProjects: Project[];
  onRemoved: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["skill", skillId], queryFn: () => skillApi.get(skillId) });
  const remove = useMutation({
    mutationFn: () => skillApi.remove(skillId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
      onRemoved();
    },
  });
  if (detail.isPending) return <Styled.Panel>스킬을 여는 중...</Styled.Panel>;
  if (detail.isError) return <ErrorBanner>{messageOf(detail.error)}</ErrorBanner>;

  const skill = detail.data;
  const removalBlocker = skillRemovalBlocker(skill, usedBy);
  const permissions = (skill.requiredPermissions ?? []).map(
    (key) => PERMISSIONS.find((item) => item.key === key)?.label ?? key,
  );
  return (
    <Styled.Panel aria-label={`${skill.id} 스킬`}>
      <div>
        <Styled.Name>{skill.id}</Styled.Name>
        <Styled.Description>{skill.description}</Styled.Description>
      </div>
      <Styled.Facts>
        <dt>출처</dt>
        <dd>
          {SKILL_SOURCE_LABEL[skill.source]}
          {skill.teamId ? ` · ${skill.teamId} ${skill.version ?? ""}` : ""}
        </dd>
        <dt>필요 권한</dt>
        <dd>{permissions.length > 0 ? permissions.join(", ") : "없음"}</dd>
        <dt>쓰는 동료</dt>
        <dd>{usedBy.length > 0 ? usedBy.map((agent) => agent.name).join(", ") : "없음"}</dd>
        <dt>쓰는 프로젝트</dt>
        <dd>
          {usedInProjects.length > 0
            ? usedInProjects.map((project) => project.name).join(", ")
            : "없음"}
        </dd>
      </Styled.Facts>
      <Styled.Files aria-label="스킬 파일">
        <li>{skill.id}/SKILL.md</li>
        {skill.files.map((file) => (
          <li key={file}>
            {skill.id}/{file}
          </li>
        ))}
      </Styled.Files>
      <Styled.Body>
        <MarkdownContent>{skill.body}</MarkdownContent>
      </Styled.Body>
      <div>
        <Button
          type="button"
          $variant="danger"
          disabled={Boolean(removalBlocker) || remove.isPending}
          onClick={() => remove.mutate()}
        >
          스킬 삭제
        </Button>
        {removalBlocker && <HelperText>{removalBlocker}</HelperText>}
      </div>
      {remove.isError && <ErrorBanner>{messageOf(remove.error)}</ErrorBanner>}
    </Styled.Panel>
  );
}
