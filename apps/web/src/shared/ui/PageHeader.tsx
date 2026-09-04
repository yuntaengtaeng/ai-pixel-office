import { mediaQuery } from "@ai-pixel-office/design-system";
import { Kicker } from "@ai-pixel-office/design-system";
import type { ReactNode } from "react";
import styled from "styled-components";

const Header = styled.header`
  display: flex;
  min-height: 82px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;

  @media ${mediaQuery.md} {
    min-height: 66px;
  }

  h1 {
    margin: 4px 0 0;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: clamp(29px, 4vw, 42px);
    letter-spacing: -0.045em;

    @media ${mediaQuery.md} {
      font-size: ${({ theme }) => theme.typography.fontSize.displaySm};
    }
  }
`;

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <Header>
      <div>
        <Kicker>{eyebrow}</Kicker>
        <h1>{title}</h1>
      </div>
      {action}
    </Header>
  );
}
