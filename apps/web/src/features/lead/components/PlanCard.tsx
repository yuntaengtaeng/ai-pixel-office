import type { ReactNode } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import type { PlanDeliverable, PlanItemProgress } from "../utils/leadView.ts";
import { josa } from "../../../shared/lib/korean.ts";

const Styled = {
  Card: styled.article<{ $closed: boolean }>`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 200px;
    gap: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x6};
    border: 1px ${({ $closed }) => ($closed ? "dashed" : "solid")}
      ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme, $closed }) =>
      $closed ? "transparent" : theme.colors.background.surface};
    ${({ $closed }) => ($closed ? "opacity: 0.6;" : "")}
    @media ${({ theme }) => theme.mediaQuery.md} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  Badge: styled.b`
    justify-self: start;
    padding: 2px 10px;
    border: 1px solid ${({ theme }) => theme.colors.border.strong};
    border-radius: ${({ theme }) => theme.radius.pill};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Progress: styled.span`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x2};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    a {
      color: ${({ theme }) => theme.colors.stamp.ink};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
  Main: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    align-content: start;
  `,
  Header: styled.header`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
    h3 {
      margin: 0;
      font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
    }
  `,
  Order: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  List: styled.ul`
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Item: styled.li<{
    $emphasis: "review" | "files" | "plain";
    $phase?: PlanItemProgress["phase"];
  }>`
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid
      ${({ theme, $emphasis }) =>
        $emphasis === "files" ? theme.colors.border.negative : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    ${({ $phase, theme }) => ($phase === "active" ? `border-color: ${theme.colors.status.working};` : "")}
    &::before {
      content: "${({ $phase }) => ($phase === "done" ? "✓" : "")}";
      width: 14px;
      height: 14px;
      margin-top: 3px;
      display: grid;
      place-items: center;
      border: 2px solid
        ${({ theme, $emphasis, $phase }) =>
          $phase === "done"
            ? theme.colors.semantic.positive
            : $phase === "active"
              ? theme.colors.status.working
              : $emphasis === "review"
                ? theme.colors.semantic.warning
                : $emphasis === "files"
                  ? theme.colors.stamp.ink
                  : theme.colors.border.strong};
      border-radius: ${({ theme }) => theme.radius.sm};
      background: ${({ theme, $phase }) =>
        $phase === "done"
          ? theme.colors.semantic.positive
          : $phase === "active"
            ? `${theme.colors.status.working}55`
            : "transparent"};
      color: ${({ theme }) => theme.colors.text.inverse};
      font-size: 10px;
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      line-height: 1;
    }
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
    }
    small {
      display: block;
      margin-top: 2px;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
    em {
      font-style: normal;
      color: ${({ theme, $emphasis }) =>
        $emphasis === "review" ? theme.colors.semantic.warning : theme.colors.stamp.ink};
    }
  `,
  Aside: styled.aside`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    align-content: start;
    padding: ${({ theme }) => theme.space.x4};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    dl {
      margin: 0;
      display: grid;
      gap: ${({ theme }) => theme.space.x3};
    }
    dt {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
    dd {
      margin: 2px 0 0;
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
};

/** 계획서 카드 (받을 것 목록과 규모, 결재 행동을 조합, 닫힌 계획서는 점선과 흐린 색) */
export function PlanCard({ closed = false, children }: { closed?: boolean; children: ReactNode }) {
  return (
    <Styled.Card aria-label="계획서" $closed={closed}>
      {children}
    </Styled.Card>
  );
}

/** 카드 왼쪽: 제목, 담당 순서, 받을 것 */
function PlanCardMain({ children }: { children: ReactNode }) {
  return <Styled.Main>{children}</Styled.Main>;
}

function PlanCardHeader({
  eyebrow,
  title,
  badge,
}: {
  eyebrow: string;
  title: string;
  /** 제목 위 상태 표시 (예: 진행 안 함) */
  badge?: string;
}) {
  return (
    <Styled.Header>
      {badge && <Styled.Badge>{badge}</Styled.Badge>}
      <span>{eyebrow}</span>
      <h3>{title}</h3>
    </Styled.Header>
  );
}

function PlanCardOrder({ order, reason }: { order: string; reason?: string }) {
  return (
    <Styled.Order>
      {order}
      {reason ? ` · ${reason}` : ""}
    </Styled.Order>
  );
}

/** 끝나면 받을 것 목록 (내가 보고 넘김, 파일 수정은 색과 문구로 구분, 결재 뒤에는 기안서 상태와 할 일) */
function PlanCardDeliverables({
  items,
  progress = [],
}: {
  items: PlanDeliverable[];
  progress?: PlanItemProgress[];
}) {
  return (
    <Styled.List>
      {items.map((item) => {
        const emphasis = item.modifiesFiles ? "files" : item.reviewBeforeNext ? "review" : "plain";
        const itemProgress = progress.find((entry) => entry.key === item.key);
        return (
          <Styled.Item key={item.key} $emphasis={emphasis} $phase={itemProgress?.phase}>
            <div>
              <strong>{item.deliverable}</strong>
              <small>
                {item.assigneeName}
                {josa(item.assigneeName, "이/가")} 맡아요.{" "}
                {item.reviewBeforeNext && <em>받으면 직접 보고 넘겨 주세요.</em>}
                {item.modifiesFiles && <em>바뀐 파일을 보고 결재해야 반영돼요.</em>}
              </small>
              {itemProgress && (
                <Styled.Progress>
                  <span>{itemProgress.state}</span>
                  {itemProgress.task && (
                    <Link to={`/tasks/${itemProgress.task.id}`}>
                      {itemProgress.nextAction ?? "기안서 보기"} →
                    </Link>
                  )}
                </Styled.Progress>
              )}
            </div>
          </Styled.Item>
        );
      })}
    </Styled.List>
  );
}

/** 카드 오른쪽: 규모와 결재 행동 */
function PlanCardAside({
  facts,
  children,
}: {
  facts: Array<{ label: string; value: string }>;
  children?: ReactNode;
}) {
  return (
    <Styled.Aside>
      <dl>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </Styled.Aside>
  );
}

PlanCard.Main = PlanCardMain;
PlanCard.Header = PlanCardHeader;
PlanCard.Order = PlanCardOrder;
PlanCard.Deliverables = PlanCardDeliverables;
PlanCard.Aside = PlanCardAside;
