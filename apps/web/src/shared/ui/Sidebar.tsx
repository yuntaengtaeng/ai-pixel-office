import styled from "styled-components";
import { Link, NavLink } from "react-router-dom";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import type { SystemStatus } from "../../features/system/api.ts";

const Styled = {
  Aside: styled.aside`
    position: fixed;
    inset: 0 auto 0 0;
    width: 228px;
    padding: 25px 18px;
    background: #354f49;
    color: #f8f1e5;
    border-right: 5px solid #283d39;
    display: flex;
    flex-direction: column;
    z-index: 10;

    @media (max-width: 760px) {
      position: sticky;
      width: 100%;
      height: auto;
      padding: 10px 13px;
      border: 0;
      border-bottom: 4px solid #283d39;
      flex-direction: row;
      align-items: center;
    }
  `,
  Brand: styled(Link)`
    display: flex;
    align-items: center;
    gap: 11px;
    font-weight: 900;
    letter-spacing: -0.02em;

    > span:last-child {
      @media (max-width: 760px) {
        display: none;
      }
    }
  `,
  BrandMark: styled.span`
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    background: ${({ theme }) => theme.colors.warning};
    color: #3c514b;
    border: 3px solid #233d38;
    box-shadow: 3px 3px 0 #203632;
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 17px;

    @media (max-width: 760px) {
      width: 36px;
      height: 36px;
    }
  `,
  RuntimeList: styled.div`
    margin-top: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;

    @media (max-width: 760px) {
      display: none;
    }

    > span {
      padding: 6px;
      border: 1px solid #6a817b;
      background: #2e4641;
      color: #aab9b4;
      opacity: 0.42;
      display: flex;
      align-items: center;
      gap: 5px;
      font: 700 9px monospace;
      transition:
        opacity 0.2s,
        box-shadow 0.2s;

      &.connected {
        opacity: 1;
        color: #eef8f2;
        border-color: #6eb78f;
        box-shadow:
          inset 0 0 0 1px #477c64,
          0 0 8px #63b48655;
      }
    }

    b {
      width: 15px;
      height: 15px;
      display: grid;
      place-items: center;
      background: #507069;
      color: #e8f0ed;
      font-size: 9px;
    }

    .connected b {
      background: #68bd8b;
      color: #173b2d;
    }
  `,
  WorkspaceChip: styled.div`
    margin: 30px 0 20px;
    padding: 11px 12px;
    border: 2px solid #58746d;
    background: #2f4843;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;

    @media (max-width: 760px) {
      display: none;
    }
  `,
  OnlineDot: styled.span`
    width: 8px;
    height: 8px;
    background: #74d39a;
    box-shadow: 0 0 0 2px #315b4c;
    display: inline-block;
  `,
  Nav: styled.nav`
    display: grid;
    gap: 7px;

    @media (max-width: 760px) {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }

    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 13px;
      color: #d7e0d9;
      font-weight: 700;
      border: 2px solid transparent;

      @media (max-width: 760px) {
        padding: 8px;
        font-size: 11px;
        gap: 4px;
      }

      span {
        width: 22px;
        text-align: center;
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: 19px;

        @media (max-width: 760px) {
          font-size: 15px;
          width: 16px;
        }
      }

      &:hover {
        background: #3c5a53;
      }

      &.active {
        background: #f3e7cf;
        color: #334d47;
        border-color: #203b35;
        box-shadow: 3px 3px 0 #233d38;
      }
    }
  `,
  Note: styled.div`
    margin-top: auto;
    padding: 14px;
    border: 2px dashed #708982;
    display: grid;
    gap: 7px;
    font-size: 11px;
    line-height: 1.5;
    color: #bfcfc8;

    @media (max-width: 760px) {
      display: none;
    }

    strong {
      color: ${({ theme }) => theme.colors.warning};
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
