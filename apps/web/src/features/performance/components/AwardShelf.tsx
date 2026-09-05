import { Panel } from "@ai-pixel-office/design-system";
import type { PerformanceAward } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { AWARD_LABEL, AWARD_SEAL } from "../constants.ts";

const Section = styled(Panel)`
  padding: ${({ theme }) => theme.space.x5};
  display: grid;
  gap: ${({ theme }) => theme.space.x3};

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    margin: 0;
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.space.x4};
`;

/** 사내 상장을 흉내낸 이중 테두리 카드, 트로피 스티커가 아니라 수여증에 가깝게 보이도록 세로 중앙 정렬 구성 */
const Certificate = styled.li`
  position: relative;
  padding: ${({ theme }) => theme.space.x6} ${({ theme }) => theme.space.x4};
  border: 1px solid ${({ theme }) => theme.colors.border.strong};
  outline: 1px solid ${({ theme }) => theme.colors.border.strong};
  outline-offset: -6px;
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
  text-align: center;
  display: grid;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x2};
`;

const Seal = styled.span`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.semantic.warning};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 2px solid ${({ theme }) => theme.colors.border.strong};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const Title = styled.strong`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  letter-spacing: 0.04em;
`;

const Divider = styled.span`
  width: 32px;
  height: 2px;
  background: ${({ theme }) => theme.colors.border.subtle};
`;

const Recipient = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

const Citation = styled.span`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
`;

export function AwardShelf({ awards }: { awards: PerformanceAward[] }) {
  if (awards.length === 0) return null;
  return (
    <Section as="section">
      <h2>이 기간의 상</h2>
      <List>
        {awards.map((award) => (
          <Certificate key={`${award.kind}-${award.agentId}`}>
            <Seal aria-hidden="true">{AWARD_SEAL[award.kind] ?? "★"}</Seal>
            <Title>{AWARD_LABEL[award.kind] ?? award.kind}</Title>
            <Divider aria-hidden="true" />
            <Recipient>{award.agentName}</Recipient>
            <Citation>{award.reason}</Citation>
          </Certificate>
        ))}
      </List>
    </Section>
  );
}
