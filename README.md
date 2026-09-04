# AI Pixel Office

귀여운 반려동물 모습의 AI 동료를 만들고 작업을 맡기는 로컬 우선 데스크톱형 웹 앱입니다. Codex와 Claude Code를 실행 엔진으로 사용하며, 실제 작업 상태와 진행 이벤트를 픽셀 오피스와 작업 상세 화면에 표시합니다.

## 기술 구성

- Web: Vite, React, TypeScript, TanStack Query, Radix UI Primitives, PixiJS
- API: Fastify, Server-Sent Events
- DB: better-sqlite3 (WAL)
- Runtime: Codex App Server, Claude Code CLI stream-json

## 코드 구조

웹은 기능 단위로 분리되어 있습니다.

```text
apps/web/src/
├─ features/
│  ├─ agents/       에이전트 생성·상세
│  ├─ dashboard/    오늘의 오피스
│  ├─ office/       픽셀 캔버스·캐릭터
│  ├─ projects/     프로젝트와 실행 폴더 선택
│  ├─ settings/     런타임·워크스페이스 설정
│  ├─ skills/       스킬 생성·목록
│  └─ tasks/        작업 카드·상세·실행
├─ shared/          공통 UI·상수·유틸리티
├─ api.ts           서버 API 접근 계층
├─ App.tsx          앱 셸과 라우팅
└─ main.tsx         React 진입점
```

서버는 HTTP 경계(`http.ts`), 작업 오케스트레이션(`orchestrator.ts`), 영속화(`repository.ts`, `database.ts`), 외부 실행 엔진 어댑터로 역할을 나눕니다.

## 실행

요구 사항은 Node.js 22.18 이상과 사용할 실행 엔진의 CLI입니다.

- Windows: `Start-AI-Pixel-Office.cmd` 더블클릭
- macOS: `Start-AI-Pixel-Office.command` 더블클릭

macOS가 최초 실행을 막으면 터미널에서 한 번만 실행 권한을 부여합니다.

```bash
chmod +x Start-AI-Pixel-Office.command
./Start-AI-Pixel-Office.command
```

직접 개발 서버를 실행하려면 다음 명령을 사용합니다.

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run dev
```

- Web: `http://localhost:47371`
- API: `http://127.0.0.1:47372`
- SQLite: `data/ai-pixel-office.sqlite`
- Runtime log: `.runtime-logs/<run-id>.jsonl`

이미 포트를 사용하는 개발 서버가 있으면 먼저 그 실행 창을 닫아 주세요. Vite가 5174 같은 다른 포트로 이동하면 API 프록시가 혼동될 수 있습니다.

## 로그인과 연결

앱의 **설정** 화면에서 Codex, Claude와 각 엔진의 Figma 연결 상태를 확인하고 필요한 명령을 복사할 수 있습니다. 로그인 자체는 보안을 위해 터미널의 각 CLI에서 진행합니다.

- Codex: `codex login`
- Claude: `claude` 실행 후 `/login`
- Figma MCP 등록: `codex mcp add figma --url https://mcp.figma.com/mcp`
- Figma OAuth: `codex mcp login figma`
- Claude Figma 등록: `claude mcp add --transport http --scope user figma-remote-mcp https://mcp.figma.com/mcp`
- Claude Figma 로그인: `claude` 실행 후 `/mcp`

Figma 권한을 켠 작업형 에이전트는 선택한 실행 엔진의 Figma 도구를 사용할 수 있습니다.

## 프로젝트와 실행 폴더

사이드바의 **프로젝트**에서 목표, 상태, Figma 링크와 작업을 프로젝트별로 관리할 수 있습니다. 새 작업은 담당자 없이 먼저 만들고 작업 상세에서 알맞은 에이전트를 배치합니다. 로컬 코드를 다루는 프로젝트라면 설정의 접힌 **개발자 옵션**에서 운영체제 폴더 선택기로 실행 폴더를 연결할 수 있습니다.

실제 실행 폴더는 아래 우선순위로 결정됩니다.

1. 작업에서 직접 덮어쓴 폴더
2. 작업이 속한 프로젝트의 폴더
3. 담당 에이전트의 기본 폴더
4. 워크스페이스의 기본 폴더
5. 서버를 실행한 폴더

프로젝트를 삭제해도 실제 폴더와 기존 작업은 삭제되지 않으며, 기존 작업의 프로젝트 연결만 해제됩니다.

## 구현 범위

- Workspace, Agent, Skill, Task, AgentRun 영속화
- AI 기반 스킬 초안과 권장 권한 매핑
- 에이전트 상세 편집, 삭제, 작업 기록, 자주 맡기는 작업
- 스킬을 선택적으로 연결하는 단일 에이전트 생성 흐름
- 프로젝트별 목표, Figma 링크, 참여 에이전트와 작업 관리
- 작업을 먼저 만든 뒤 상세 화면에서 담당 에이전트를 배치하는 흐름
- Inbox에 요청·아이디어를 빠르게 담고 Task로 전환하는 흐름
- 여러 에이전트가 앞 단계 결과를 이어받는 순차 Workflow와 재사용 가능한 협업 그룹
- Codex/Claude 실행, 취소, 권한 승인, 실패 원인 표시
- 실행 메시지와 도구 사용 내역의 실시간 진행 표시
- Markdown/GFM 작업 결과 렌더링과 결과 확인·수정 요청
- 다양한 강아지와 고양이 픽셀 캐릭터 조합
- 픽셀 오피스 책상 모니터의 Codex·Claude 실행 엔진 표시
- 다수 에이전트에 맞춰 확장되는 오피스와 상태별 생활 애니메이션
- Windows/macOS 원클릭 실행기

프로덕션 웹 빌드는 `npm.cmd run build`, 실제 Codex를 포함한 전체 smoke 검증은 `npm.cmd run smoke:mvp`로 실행합니다.

## 문서

- [API reference](docs/api.md)
- [MVP status](docs/mvp-0-status.md)
- [Runtime capability matrix](docs/runtime-capability-matrix.md)
