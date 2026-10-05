import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import type { AgentModel, Workspace } from "@ai-pixel-office/domain/entities";
import type { SystemStatus } from "../../features/system/api.ts";

type NavItem = { to: string; label: string; end?: boolean; showDeskCount?: boolean };

/** 사이드바 트리 항목 (하위 항목은 색 점과 함께 들여 표시) */
export type SidebarTreeItem = {
  to: string;
  label: string;
  /** 지금 무언가 진행 중인지 (이름 옆에 움직이는 점) */
  busy?: boolean;
  children: Array<{ to: string; label: string; color: string; title?: string }>;
};

const busyPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`;

const WORK_GROUP: { title: string; items: NavItem[] } = {
  title: "업무",
  items: [
    { to: "/", label: "오피스", end: true },
    { to: "/inbox", label: "결재함", showDeskCount: true },
    { to: "/chat", label: "프로젝트 없이 대화" },
  ],
};

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "팀",
    items: [
      { to: "/agents", label: "조직도" },
      { to: "/skills", label: "교육 자료실" },
    ],
  },
  {
    title: "자료",
    items: [
      { to: "/records", label: "기록" },
      { to: "/performance", label: "인사평가" },
    ],
  },
];

const RUNTIME_LABEL: Record<AgentModel, string> = { claude: "Claude", codex: "Codex" };

const Styled = {
  Sidebar: styled.aside`
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.space.x5};
    padding: ${({ theme }) => `${theme.space.x4} ${theme.space.x3}`};
    border-right: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.brand.primaryDark};
    overflow-y: auto;

    @media ${({ theme }) => theme.mediaQuery.md} {
      position: static;
      height: auto;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      border-right: 0;
      border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    }
  `,
  Brand: styled.div`
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: ${({ theme }) => `0 ${theme.space.x2}`};
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.lead};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
    span {
      overflow: hidden;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  Nav: styled.nav`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    @media ${({ theme }) => theme.mediaQuery.md} {
      display: flex;
      flex-wrap: wrap;
      gap: ${({ theme }) => theme.space.x1};
    }
  `,
  Group: styled.div`
    display: grid;
    gap: 2px;
    h2 {
      padding: ${({ theme }) => `0 ${theme.space.x2} ${theme.space.x1}`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    }
    @media ${({ theme }) => theme.mediaQuery.md} {
      display: contents;
      h2 {
        display: none;
      }
    }
  `,
  Link: styled(NavLink)`
    min-height: 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `0 ${theme.space.x2}`};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    &:hover {
      background: ${({ theme }) => theme.colors.background.surface};
      color: ${({ theme }) => theme.colors.text.primary};
    }
    &.active {
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
  NewRequest: styled(NavLink)`
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.stamp.ink};
    color: ${({ theme }) => theme.colors.stamp.onStamp};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    &:hover {
      filter: brightness(1.08);
    }
  `,
  GroupHeading: styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    a {
      padding: ${({ theme }) => `0 ${theme.space.x2}`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
    a:hover,
    a.active {
      color: ${({ theme }) => theme.colors.text.primary};
    }
    @media ${({ theme }) => theme.mediaQuery.md} {
      display: none;
    }
  `,
  ChildLink: styled(NavLink)`
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `0 ${theme.space.x2} 0 ${theme.space.x5}`};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &:hover,
    &.active {
      background: ${({ theme }) => theme.colors.background.surface};
      color: ${({ theme }) => theme.colors.text.primary};
    }
    @media ${({ theme }) => theme.mediaQuery.md} {
      display: none;
    }
  `,
  Busy: styled.i`
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: ${({ theme }) => theme.radius.circle};
    background: ${({ theme }) => theme.colors.status.working};
    animation: ${busyPulse} 1.4s ease-in-out infinite;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Dot: styled.i<{ $color: string }>`
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: ${({ theme }) => theme.radius.circle};
    background: ${({ $color }) => $color};
  `,
  Count: styled.span`
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: inline-grid;
    place-items: center;
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => theme.colors.stamp.ink};
    color: ${({ theme }) => theme.colors.stamp.onStamp};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
  Footer: styled.div`
    margin-top: auto;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding-top: ${({ theme }) => theme.space.x3};
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    @media ${({ theme }) => theme.mediaQuery.md} {
      margin: 0 0 0 auto;
      padding-top: 0;
      border-top: 0;
      grid-auto-flow: column;
      align-items: center;
    }
  `,
  Runtimes: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => `0 ${theme.space.x2}`};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Runtime: styled.span<{ $connected: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x1};
    color: ${({ theme, $connected }) =>
      $connected ? theme.colors.text.secondary : theme.colors.text.muted};
    &::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: ${({ theme }) => theme.radius.circle};
      background: ${({ theme, $connected }) =>
        $connected ? theme.colors.semantic.positive : theme.colors.border.strong};
    }
  `,
};

function NavGroup({
  group,
  deskCount,
}: {
  group: { title: string; items: NavItem[] };
  deskCount: number;
}) {
  return (
    <Styled.Group>
      <h2>{group.title}</h2>
      {group.items.map((item) => (
        <Styled.Link key={item.to} to={item.to} end={item.end}>
          {item.label}
          {item.showDeskCount && deskCount > 0 && (
            <Styled.Count aria-label={`결재 대기 ${deskCount}건`}>{deskCount}</Styled.Count>
          )}
        </Styled.Link>
      ))}
    </Styled.Group>
  );
}

/** 앱 사이드바 (새 요청, 메뉴 그룹, 프로젝트 트리, 결재함 대기 수, 런타임 출근 상태, 설정) */
export function AppSidebar({
  workspace,
  runtimeStatus,
  deskCount,
  projects,
}: {
  workspace: Workspace;
  runtimeStatus: SystemStatus;
  deskCount: number;
  projects: SidebarTreeItem[];
}) {
  return (
    <Styled.Sidebar>
      <Styled.Brand>
        <strong>Pixel Office</strong>
        <span>{workspace.name}</span>
      </Styled.Brand>
      <Styled.NewRequest to="/new">+ 새 요청</Styled.NewRequest>
      <Styled.Nav aria-label="주 메뉴">
        <NavGroup group={WORK_GROUP} deskCount={deskCount} />
        <Styled.Group>
          <Styled.GroupHeading>
            <h2>프로젝트</h2>
            <NavLink to="/projects" end>
              전체
            </NavLink>
          </Styled.GroupHeading>
          {projects.map((project) => (
            <Fragment key={project.to}>
              <Styled.Link to={project.to}>
                {project.label}
                {project.busy && <Styled.Busy role="status" aria-label="진행 중" />}
              </Styled.Link>
              {project.children.map((child) => (
                <Styled.ChildLink key={child.to} to={child.to} title={child.title}>
                  <Styled.Dot $color={child.color} />
                  <span>{child.label}</span>
                </Styled.ChildLink>
              ))}
            </Fragment>
          ))}
        </Styled.Group>
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.title} group={group} deskCount={deskCount} />
        ))}
      </Styled.Nav>
      <Styled.Footer>
        <Styled.Runtimes aria-label="런타임 출근 상태">
          <span>출근</span>
          {(["claude", "codex"] as const).map((runtime) => (
            <Styled.Runtime key={runtime} $connected={runtimeStatus[runtime].authenticated}>
              {RUNTIME_LABEL[runtime]}
            </Styled.Runtime>
          ))}
        </Styled.Runtimes>
        <Styled.Link to="/settings">설정</Styled.Link>
      </Styled.Footer>
    </Styled.Sidebar>
  );
}
