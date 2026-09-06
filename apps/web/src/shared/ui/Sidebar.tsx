import { mediaQuery } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { Link, NavLink } from "react-router-dom";
import type { AgentModel, Workspace } from "@ai-pixel-office/domain/entities";
import type { SystemStatus } from "../../features/system/api.ts";

const Styled = {
  Aside: styled.aside`
    position: fixed;
    inset: 0 auto 0 0;
    width: 228px;
    padding: ${({ theme }) => `${theme.space.x6} ${theme.space.x5}`};
    background: ${({ theme }) => theme.colors.brand.primaryDark};
    color: ${({ theme }) => theme.colors.text.inverse};
    border-right: 4px solid ${({ theme }) => theme.colors.brand.primary};
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    z-index: ${({ theme }) => theme.zIndex.navigation};

    @media ${mediaQuery.md} {
      position: sticky;
      width: 100%;
      height: auto;
      padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
      border: 0;
      border-bottom: 4px solid ${({ theme }) => theme.colors.brand.primary};
      flex-direction: row;
      align-items: center;
      overflow-y: visible;
    }
  `,
  Brand: styled(Link)`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
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
    margin-top: ${({ theme }) => theme.space.x4};
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      display: none;
    }
  `,
  RuntimeBadge: styled.span<{ $runtime: AgentModel; $connected: boolean }>`
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme, $runtime }) => theme.colors.runtime[$runtime]};
    background: ${({ theme, $runtime }) => theme.colors.runtime[$runtime]};
    color: ${({ theme }) => theme.colors.text.inverse};
    opacity: ${({ $connected }) => ($connected ? 1 : 0.6)};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    transition:
      opacity 0.2s,
      box-shadow 0.2s;

    ${({ $connected, theme }) =>
      $connected &&
      `
        box-shadow:
          inset 0 0 0 1px ${theme.colors.semantic.positive},
          0 0 8px ${theme.colors.shadow.glow};
      `}
  `,
  WorkspaceChip: styled.div`
    margin: ${({ theme }) => `${theme.space.x8} 0 ${theme.space.x5}`};
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    border: 2px solid ${({ theme }) => theme.colors.brand.primary};
    background: ${({ theme }) => theme.colors.brand.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};

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
    gap: ${({ theme }) => theme.space.x4};
    margin-bottom: ${({ theme }) => theme.space.x6};

    @media ${mediaQuery.md} {
      margin-left: auto;
      margin-bottom: 0;
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.space.x1};
    }
  `,
  NavGroup: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      display: contents;
    }

    a {
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.space.x3};
      padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
      color: ${({ theme }) => theme.colors.text.inverse};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      border: 2px solid transparent;

      @media ${mediaQuery.md} {
        padding: ${({ theme }) => theme.space.x2};
        font-size: ${({ theme }) => theme.typography.fontSize.compact};
        gap: ${({ theme }) => theme.space.x1};
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
  NavGroupLabel: styled.span`
    padding: 0 ${({ theme }) => theme.space.x3};
    color: ${({ theme }) => theme.colors.text.onBrandMuted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    letter-spacing: 0.08em;
    text-transform: uppercase;

    @media ${mediaQuery.md} {
      display: none;
    }
  `,
  Note: styled.div`
    margin-top: auto;
    padding: ${({ theme }) => theme.space.x4};
    border: 2px dashed ${({ theme }) => theme.colors.brand.primary};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
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
        <Styled.RuntimeBadge
          $runtime="codex"
          $connected={runtimeStatus?.codex.authenticated ?? false}
          title={`Codex · ${runtimeStatus?.codex.detail ?? "확인 중"}`}
        >
          Codex
        </Styled.RuntimeBadge>
        <Styled.RuntimeBadge
          $runtime="claude"
          $connected={runtimeStatus?.claude.authenticated ?? false}
          title={`Claude · ${runtimeStatus?.claude.detail ?? "확인 중"}`}
        >
          Claude
        </Styled.RuntimeBadge>
      </Styled.RuntimeList>
      <Styled.WorkspaceChip>
        <Styled.OnlineDot />
        {workspace.name}
      </Styled.WorkspaceChip>
      <Styled.Nav>
        <Styled.NavGroup>
          <Styled.NavGroupLabel>업무</Styled.NavGroupLabel>
          <NavLink to="/" end>
            <span>⌂</span> 사무실
          </NavLink>
          <NavLink to="/chat">
            <span>◈</span> 메신저
          </NavLink>
          <NavLink to="/projects">
            <span>▦</span> 프로젝트
          </NavLink>
        </Styled.NavGroup>
        <Styled.NavGroup>
          <Styled.NavGroupLabel>팀</Styled.NavGroupLabel>
          <NavLink to="/agents">
            <span>♟</span> 에이전트
          </NavLink>
          <NavLink to="/skills">
            <span>✦</span> 스킬
          </NavLink>
        </Styled.NavGroup>
        <Styled.NavGroup>
          <Styled.NavGroupLabel>경영지원</Styled.NavGroupLabel>
          <NavLink to="/records">
            <span>▤</span> 자료실
          </NavLink>
          <NavLink to="/performance">
            <span>★</span> 인사평가
          </NavLink>
        </Styled.NavGroup>
        <Styled.NavGroup>
          <Styled.NavGroupLabel>관리</Styled.NavGroupLabel>
          <NavLink to="/settings">
            <span>⚙</span> 설정
          </NavLink>
        </Styled.NavGroup>
      </Styled.Nav>
      <Styled.Note>
        <strong>LOCAL FIRST</strong>
        <span>내 컴퓨터에서 안전하게 실행됩니다.</span>
      </Styled.Note>
    </Styled.Aside>
  );
}
