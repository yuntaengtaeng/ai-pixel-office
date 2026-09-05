import styled, { keyframes } from "styled-components";

const pixelWork = keyframes`
  from { height: 8px; opacity: 0.45; }
  to { height: 31px; opacity: 1; }
`;

const Container = styled.div<{ $waiting: boolean }>`
  min-height: 230px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x3};
  text-align: center;

  strong {
    color: ${({ theme }) => theme.colors.text.positive};
    font-size: ${({ theme }) => theme.typography.fontSize.title};
  }
  p {
    max-width: 420px;
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    line-height: 1.6;
  }

  ${({ $waiting, theme }) => $waiting && `& span { background: ${theme.colors.brand.primaryDark}; }`}
`;

const Pixels = styled.div`
  display: flex;
  align-items: end;
  gap: ${({ theme }) => theme.space.x1};
  height: 34px;

  span {
    width: 10px;
    height: 10px;
    background: ${({ theme }) => theme.colors.brand.primary};
    animation: ${pixelWork} 0.9s infinite alternate;
    &:nth-child(2) {
      animation-delay: 0.15s;
    }
    &:nth-child(3) {
      animation-delay: 0.3s;
    }
    &:nth-child(4) {
      animation-delay: 0.45s;
    }
  }
`;

export function WorkInProgress({ waiting }: { waiting: boolean }) {
  return (
    <Container $waiting={waiting}>
      <Pixels aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </Pixels>
      <strong>
        {waiting ? "에이전트가 승인을 기다리고 있어요" : "에이전트가 작업하고 있어요"}
      </strong>
      <p>
        {waiting
          ? "오른쪽의 승인 요청을 확인하면 작업이 계속됩니다."
          : "파일을 살펴보고 결과를 정리하는 중입니다. 이 화면은 자동으로 갱신됩니다."}
      </p>
    </Container>
  );
}
