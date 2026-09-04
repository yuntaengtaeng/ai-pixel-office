import type { ReactNode } from "react";
import styled from "styled-components";

const Styled = {
  PageHeader: styled.header`
    min-height: 82px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 25px;

    @media (max-width: 760px) {
      min-height: 66px;
    }

    h1 {
      margin: 5px 0 0;
      color: #3d3632;
      font-size: clamp(29px, 4vw, 42px);
      letter-spacing: -0.045em;

      @media (max-width: 760px) {
        font-size: 30px;
      }
    }
  `,
  Empty: styled.div`
    padding: 19px 8px;
    color: #9a8f84;
    font-size: 12px;
    text-align: center;
  `,
  ErrorBanner: styled.div`
    padding: 10px 12px;
    border: 2px solid #c66b62;
    background: #f8dfda;
    color: #8b3c38;
    font-size: 11px;
    font-weight: 700;
    grid-column: 1 / -1;
  `,
  FullMessage: styled.div<{ $error: boolean }>`
    min-height: 100vh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    background: ${({ theme }) => theme.colors.canvas};
    color: ${({ $error }) => ($error ? "#9b403d" : "#4d5f58")};

    > span {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      background: #f3c66f;
      border: 3px solid #574c43;
      box-shadow: 4px 4px 0 #b8a995;
      font: 900 24px monospace;
    }
  `,
};

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
    <Styled.PageHeader>
      <div>
        <span className="kicker">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </Styled.PageHeader>
  );
}

export function FullScreenMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <Styled.FullMessage $error={error}>
      <span>{error ? "!" : "…"}</span>
      <strong>{children}</strong>
    </Styled.FullMessage>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <Styled.ErrorBanner>! {children}</Styled.ErrorBanner>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <Styled.Empty>{children}</Styled.Empty>;
}
