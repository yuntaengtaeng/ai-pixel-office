import { mediaQuery } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { Link, NavLink } from "react-router-dom";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import type { SystemStatus } from "../../features/system/api.ts";

const Styled = {
  Aside: styled.aside`
    position: fixed;
    inset: 0 auto 0 0;
    width: 228px;
    padding: 24px 20px;
    background: ${({ theme }) => theme.colors.brand.primaryDark};
    color: ${({ theme }) => theme.colors.text.inverse};
    border-right: 4px solid ${({ theme }) => theme.colors.brand.primary};
    display: flex;
    flex-direction: column;
    z-index: ${({ theme }) => theme.zIndex.navigation};

    @media ${mediaQuery.md} {
      position: sticky;
      width: 100%;
      height: auto;
      padding: 12px 12px;
      border: 0;
      border-bottom: 4px solid ${({ theme }) => theme.colors.brand.primary};
      flex-direction: row;
      align-items: center;
    }
  `,
  Brand: styled(Link)`
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    letter-spacing: -0.02em;

    > span:last-child {
      @media ${mediaQuery.md} {
        display: none;
      }
    }
  `,
  BrandMark: styled.span`
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    background: ${({ theme }) => theme.colors.semantic.warning};
    color: ${({ theme }) => theme.colors.text.primary};
    border: 2px solid ${({ theme }) => theme.colors.border.strong};
    box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.title};

    @media ${mediaQuery.md} {
      width: 36px;
      height: 36px;
    }
  `,
  RuntimeList: styled.div`
    margin-top: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    @media ${mediaQuery.md} {
      display: none;
    }

    > span {
      padding: 8px;
      border: 1px solid ${({ theme }) => theme.colors.brand.primary};
      background: ${({ theme }) => theme.colors.brand.primary};
      color: ${({ theme }) => theme.colors.text.inverse};
      opacity: 0.6;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      transition:
        opacity 0.2s,
        box-shadow 0.2s;

      &.connected {
        opacity: 1;
        color: ${({ theme }) => theme.colors.text.inverse};
        border-color: ${({ theme }) => theme.colors.semantic.positive};
        box-shadow:
          inset 0 0 0 1px ${({ theme }) => theme.colors.semantic.positive},
          0 0 8px ${({ theme }) => theme.colors.shadow.glow};
      }
    }

    b {
      width: 15px;
      height: 15px;
      display: grid;
      place-items: center;
      background: ${({ theme }) => theme.colors.brand.primaryDark};
      color: ${({ theme }) => theme.colors.text.inverse};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }

    .connected b {
      background: ${({ theme }) => theme.colors.semantic.positive};
      color: ${({ theme }) => theme.colors.text.inverse};
    }
  `,
  WorkspaceChip: styled.div`
    margin: 32px 0 20px;
    padding: 12px 12px;
    border: 2px solid ${({ theme }) => theme.colors.brand.primary};
    background: ${({ theme }) => theme.colors.brand.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    display: flex;
    align-items: center;
    gap: 8px;

    @media ${mediaQuery.md} {
      display: none;
    }
  `,
  OnlineDot: styled.span`
    width: 8px;
    height: 8px;
    background: ${({ theme }) => theme.colors.semantic.positive};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.brand.primaryDark};
    display: inline-block;
  `,
  Nav: styled.nav`
    display: grid;
    gap: 8px;

    @media ${mediaQuery.md} {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }

    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 12px;
      color: ${({ theme }) => theme.colors.text.inverse};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      border: 2px solid transparent;

      @media ${mediaQuery.md} {
        padding: 8px;
        font-size: ${({ theme }) => theme.typography.fontSize.compact};
        gap: 4px;
      }

      span {
        width: 22px;
        text-align: center;
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.headingSm};

        @media ${mediaQuery.md} {
          font-size: ${({ theme }) => theme.typography.fontSize.lead};
          width: 16px;
        }
      }

      &:hover {
        background: ${({ theme }) => theme.colors.brand.primary};
      }

      &.active {
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
        color: ${({ theme }) => theme.colors.text.primary};
        border-color: ${({ theme }) => theme.colors.border.strong};
        box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
      }
    }
  `,
  Note: styled.div`
    margin-top: auto;
    padding: 16px;
    border: 2px dashed ${({ theme }) => theme.colors.brand.primary};
    display: grid;
    gap: 8px;
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.text.inverse};

    @media ${mediaQuery.md} {
      display: none;
    }

    strong {
      color: ${({ theme }) => theme.colors.semantic.warning};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      letter-spacing: 0.08em;
    }
  `,
};

export function Sidebar({
  workspace,
  runtimeStatus,
}: {
  workspace: Workspace;
  runtimeStatus?: SystemStatus;
}) {
  return (
    <Styled.Aside>
      <Styled.Brand to="/">
        <Styled.BrandMark>AO</Styled.BrandMark>
        <span>AI Pixel Office</span>
      </Styled.Brand>
      <Styled.RuntimeList aria-label="실행 엔진 연결 상태">
        <span
          className={runtimeStatus?.codex.authenticated ? "connected" : ""}
          title={`Codex · ${runtimeStatus?.codex.detail ?? "확인 중"}`}
        >
          <b>C</b>Codex
        </span>
        <span
          className={runtimeStatus?.claude.authenticated ? "connected" : ""}
          title={`Claude · ${runtimeStatus?.claude.detail ?? "확인 중"}`}
        >
          <b>A</b>Claude
        </span>
      </Styled.RuntimeList>
      <Styled.WorkspaceChip>
        <Styled.OnlineDot />
        {workspace.name}
      </Styled.WorkspaceChip>
      <Styled.Nav>
        <NavLink to="/" end>
          <span>⌂</span> 사무실
        </NavLink>
        <NavLink to="/projects">
          <span>▦</span> 프로젝트
        </NavLink>
        <NavLink to="/agents">
          <span>♟</span> 에이전트
        </NavLink>
        <NavLink to="/skills">
          <span>✦</span> 스킬
        </NavLink>
        <NavLink to="/settings">
          <span>⚙</span> 설정
        </NavLink>
      </Styled.Nav>
      <Styled.Note>
        <strong>LOCAL FIRST</strong>
        <span>내 컴퓨터에서 안전하게 실행됩니다.</span>
      </Styled.Note>
    </Styled.Aside>
  );
}
