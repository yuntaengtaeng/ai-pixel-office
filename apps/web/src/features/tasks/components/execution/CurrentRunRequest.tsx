import styled from "styled-components";

const Styled = {
  CurrentRunRequest: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    margin: ${({ theme }) => `${theme.space.x4} 0 ${theme.space.x1}`};
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    border-left: 4px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};

    span {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      line-height: 1.55;
      white-space: pre-wrap;
    }
  `,
};

export function CurrentRunRequest({ request }: { request: string }) {
  return (
    <Styled.CurrentRunRequest>
      <span>현재 요청</span>
      <p>{request}</p>
    </Styled.CurrentRunRequest>
  );
}
