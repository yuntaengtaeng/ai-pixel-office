import styled, { type DefaultTheme } from "styled-components";
import type { ApprovalCell, ApprovalCellState } from "../../utils/approvalLine.ts";

const STATE_LABEL: Record<Exclude<ApprovalCellState, "stamped">, string> = {
  working: "작업 중",
  failed: "멈춤",
  waiting: "대기",
  mine: "내 차례",
};

function stateColor(theme: DefaultTheme, state: ApprovalCellState): string {
  switch (state) {
    case "mine":
      return theme.colors.stamp.ink;
    case "failed":
      return theme.colors.semantic.negative;
    default:
      return theme.colors.text.muted;
  }
}

const Styled = {
  Line: styled.div`
    display: inline-flex;
    border: 1px solid ${({ theme }) => theme.colors.border.strong};
    border-radius: ${({ theme }) => theme.radius.sm};
    overflow: hidden;
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    text-align: center;
  `,
  Title: styled.div`
    width: 26px;
    display: grid;
    place-items: center;
    border-right: 1px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    font-family: ${({ theme }) => theme.typography.fontFamily.serif};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    writing-mode: vertical-rl;
    letter-spacing: 0.4em;
  `,
  Cell: styled.div<{ $mine: boolean }>`
    width: 84px;
    display: grid;
    grid-template-rows: 26px 70px;
    border-right: 1px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme, $mine }) => ($mine ? theme.colors.stamp.soft : "transparent")};
    &:last-child {
      border-right: 0;
    }
  `,
  Heading: styled.div`
    display: grid;
    place-items: center;
    padding: 0 ${({ theme }) => theme.space.x1};
    overflow: hidden;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  Mark: styled.div`
    display: grid;
    place-items: center;
  `,
  Stamp: styled.span`
    width: 50px;
    height: 50px;
    display: grid;
    place-items: center;
    border: 3px solid ${({ theme }) => theme.colors.stamp.ink};
    border-radius: ${({ theme }) => theme.radius.circle};
    color: ${({ theme }) => theme.colors.stamp.ink};
    font-family: ${({ theme }) => theme.typography.fontFamily.serif};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    transform: rotate(-8deg);
    opacity: 0.9;
  `,
  State: styled.span<{ $state: ApprovalCellState }>`
    color: ${({ theme, $state }) => stateColor(theme, $state)};
    font-weight: ${({ theme, $state }) =>
      $state === "mine" ? theme.typography.fontWeight.bold : theme.typography.fontWeight.regular};
  `,
};

/** 기안서 결재란 (담당별 도장과 마지막 승인 칸) */
export function ApprovalLine({ cells }: { cells: ApprovalCell[] }) {
  return (
    <Styled.Line role="group" aria-label="결재란">
      <Styled.Title aria-hidden="true">결재</Styled.Title>
      {cells.map((cell) => (
        <Styled.Cell key={cell.key} $mine={cell.state === "mine"}>
          <Styled.Heading title={cell.heading}>{cell.heading}</Styled.Heading>
          <Styled.Mark>
            {cell.state === "stamped" ? (
              <Styled.Stamp aria-label={`${cell.stampName} 결재 완료`}>
                {cell.stampName}
              </Styled.Stamp>
            ) : (
              <Styled.State $state={cell.state}>{STATE_LABEL[cell.state]}</Styled.State>
            )}
          </Styled.Mark>
        </Styled.Cell>
      ))}
    </Styled.Line>
  );
}
