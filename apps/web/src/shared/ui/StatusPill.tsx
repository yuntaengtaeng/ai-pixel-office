import styled from "styled-components";
import type { TaskStatus } from "@ai-pixel-office/domain/entities";
import { STATUS } from "../config/presentation.ts";

const Pill = styled.span<{ $status: TaskStatus }>`
  display: inline-block;
  padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
  border: 2px solid currentColor;
  border-top-color: ${({ $status }) => STATUS[$status].color};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
  font-family: ${({ theme }) => theme.typography.fontFamily.base};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

export function StatusPill({ status }: { status: TaskStatus }) {
  return <Pill $status={status}>{STATUS[status].label}</Pill>;
}
