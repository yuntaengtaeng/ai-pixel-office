import styled from "styled-components";
import { Fieldset, HelperText, Input, Legend } from "@ai-pixel-office/design-system";
import type { Skill } from "@ai-pixel-office/domain/entities";
import { PERMISSIONS } from "../../../shared/config/presentation.ts";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { CheckChip, CheckGrid } from "./CheckboxGrid.tsx";

const Styled = {
  IntroText: styled(HelperText)`
    margin-bottom: ${({ theme }) => theme.space.x2};
  `,
  MappedPermissions: styled.div`
    margin-top: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x2};
    border-left: 3px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }

    > div {
      display: flex;
      flex-wrap: wrap;
      gap: ${({ theme }) => theme.space.x1};
    }

    span {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
};

/** Agent 생성/수정 폼 공용 스킬 선택 - 선택한 스킬이 요구하는 권한을 자동 적용 요약과 함께 표시 */
export function AgentSkillsField({
  skills,
  selectedSkills,
  onToggleSkill,
}: {
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (skill: Skill) => void;
}) {
  const mappedSkillPermissions = Array.from(
    new Set(
      skills
        .filter((skill) => selectedSkills.includes(skill.id))
        .flatMap((skill) => skill.requiredPermissions ?? []),
    ),
  );
  return (
    <Fieldset>
      <Legend>스킬 · 선택 사항</Legend>
      <Styled.IntroText>
        스킬 없이도 기본 업무를 수행합니다. 반복해서 잘해야 할 전문 업무가 있으면 스킬을 연결하세요.
      </Styled.IntroText>
      <CheckGrid>
        {skills.map((skill) => (
          <CheckChip
            key={skill.id}
            title={
              (skill.requiredPermissions ?? []).length > 0
                ? `필요 권한: ${(skill.requiredPermissions ?? []).map((permission) => PERMISSIONS.find((item) => item.key === permission)?.label ?? permission).join(", ")}`
                : undefined
            }
          >
            <Input
              type="checkbox"
              checked={selectedSkills.includes(skill.id)}
              onChange={() => onToggleSkill(skill)}
            />
            <span>{skill.name}</span>
          </CheckChip>
        ))}
        {skills.length === 0 && (
          <Empty>스킬 없이 바로 만들 수 있습니다. 나중에 스킬 작업실에서 추가하세요.</Empty>
        )}
      </CheckGrid>
      {mappedSkillPermissions.length > 0 && (
        <Styled.MappedPermissions>
          <strong>자동으로 적용될 권한</strong>
          <div>
            {mappedSkillPermissions.map((permission) => (
              <span key={permission}>
                {PERMISSIONS.find((item) => item.key === permission)?.label ?? permission}
              </span>
            ))}
          </div>
        </Styled.MappedPermissions>
      )}
    </Fieldset>
  );
}
