import { Link } from "react-router-dom";
import styled, { type DefaultTheme } from "styled-components";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { PetPreview } from "../../office/PetPreview.tsx";
import {
  DESK_ACTION_LABEL,
  DESK_DOCUMENT_LABEL,
  formatWaited,
  type DeskDocumentKind,
  type DeskItem,
} from "../utils/deskItems.ts";

function kindColor(theme: DefaultTheme, kind: DeskDocumentKind): string {
  switch (kind) {
    case "permission":
      return theme.colors.stamp.ink;
    case "question":
      return theme.colors.semantic.warning;
    case "failure":
      return theme.colors.semantic.negative;
    case "supplement":
      return theme.colors.status.blocked;
    case "draft":
      return theme.colors.brand.primary;
  }
}

const Styled = {
  Card: styled.article`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
  `,
  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Kind: styled.span<{ $kind: DeskDocumentKind }>`
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x3}`};
    border-radius: ${({ theme }) => theme.radius.pill};
    border: 1px solid ${({ theme, $kind }) => kindColor(theme, $kind)};
    color: ${({ theme, $kind }) => kindColor(theme, $kind)};
    font-family: ${({ theme }) => theme.typography.fontFamily.serif};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
  Waited: styled.span`
    color: ${({ theme }) => theme.colors.text.muted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Title: styled.h3`
    font-size: ${({ theme }) => theme.typography.fontSize.lead};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    line-height: 1.4;
  `,
  Footer: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Assignee: styled.span`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  Action: styled(Link)`
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: ${({ theme }) => `0 ${theme.space.x3}`};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.action.primary.background};
    color: ${({ theme }) => theme.colors.action.primary.foreground};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
};

/** 결재함 서류 한 장 (서류 종류, 기다린 시간, 담당 동료, 대표 행동) */
export function DeskItemCard({
  item,
  assignee,
  now,
}: {
  item: DeskItem;
  assignee?: Agent;
  now: Date;
}) {
  return (
    <Styled.Card>
      <Styled.Header>
        <Styled.Kind $kind={item.kind}>{DESK_DOCUMENT_LABEL[item.kind]}</Styled.Kind>
        <Styled.Waited>{formatWaited(item.waitingSince, now)} 대기</Styled.Waited>
      </Styled.Header>
      <Styled.Title>{item.task.title}</Styled.Title>
      <Styled.Footer>
        {assignee?.avatarId && <PetPreview petId={assignee.avatarId} size={24} />}
        <Styled.Assignee>
          {assignee ? `${assignee.name} · ${assignee.role}` : "담당 동료 없음"}
        </Styled.Assignee>
        <Styled.Action to={`/tasks/${item.task.id}`}>{DESK_ACTION_LABEL[item.kind]}</Styled.Action>
      </Styled.Footer>
    </Styled.Card>
  );
}
