import type { TaskDetail } from "../../api.ts";
import { TaskResultView } from "./TaskResultView.tsx";

import styled from "styled-components";

const Styled = {
  PreviousResult: styled.details`
    margin-top: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > summary {
      padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;
    }

    > div {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x3} ${theme.space.x3}`};
      border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    }
  `,
};

export function PreviousResult({ result }: { result: NonNullable<TaskDetail["result"]> }) {
  return (
    <Styled.PreviousResult>
      <summary>이전 결과 보기</summary>
      <div>
        <TaskResultView result={result} />
      </div>
    </Styled.PreviousResult>
  );
}
