import styled from "styled-components";

const Container = styled.div`
  min-height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.x4};
  padding: ${({ theme }) => theme.space.x6};
  > span {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    background: ${({ theme }) => theme.colors.semantic.negative};
    color: ${({ theme }) => theme.colors.text.inverse};
    border: 3px solid ${({ theme }) => theme.colors.border.negative};
    box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.border.negative};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  }
  div {
    max-width: 560px;
  }
  strong {
    color: ${({ theme }) => theme.colors.text.negative};
  }
  p {
    margin: ${({ theme }) => `${theme.space.x2} 0 0`};
    color: ${({ theme }) => theme.colors.text.negative};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export function FailureState({ error }: { error?: string }) {
  return (
    <Container>
      <span>!</span>
      <div>
        <strong>작업을 완료하지 못했습니다.</strong>
        <p>
          {error || "실행이 예기치 않게 종료되었습니다. 실행 기록을 확인한 뒤 다시 시도해 주세요."}
        </p>
      </div>
    </Container>
  );
}
