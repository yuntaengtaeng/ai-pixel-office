import styled from "styled-components";
import { PixelWorkLoader } from "../../../../shared/ui/PixelWorkLoader.tsx";

const Container = styled.div<{ $waiting: boolean }>`
  min-height: 230px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x3};
  text-align: center;

  ${({ $waiting, theme }) => $waiting && `& span { background: ${theme.colors.brand.primaryDark}; }`}
`;

export function WorkInProgress({ waiting }: { waiting: boolean }) {
  return (
    <Container $waiting={waiting}>
      <PixelWorkLoader
        title={waiting ? "에이전트가 승인을 기다리고 있어요" : "에이전트가 작업하고 있어요"}
        description={
          waiting
            ? "오른쪽의 승인 요청을 확인하면 작업이 계속됩니다."
            : "파일을 살펴보고 결과를 정리하는 중입니다. 이 화면은 자동으로 갱신됩니다."
        }
      />
    </Container>
  );
}
