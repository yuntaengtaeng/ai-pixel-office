# Architecture

이 문서는 현재 구현과 합의된 목표를 구분해 기록한다. 구체적인 폴더명은 현재 지도이며 관련 ADR이
원칙으로 정하지 않은 한 영구 규칙이 아니다.

## 현재 workspace

```text
apps/
  desktop/             Electron main/preload, installer 설정
  server/              로컬 Fastify API, Node SQLite, runtime orchestration
  web/                 React renderer, Pixel Office
packages/
  domain/              제품 entity, validation, task state
  runtime-protocol/    Claude/Codex 공통 event와 capability 계약
  design-token/        색상·spacing·shadow 등 원시 design token
  pet/                 펫 카탈로그, 픽셀 스프라이트, 렌더러 독립 이동 상태
  design-system/       styled-components 공통 primitive + design-token 재노출(web의 유일한 공개 진입점)
scripts/runtime-spike/ 런타임 capability 검증 도구
test/                  domain/API/orchestrator 통합 테스트
```

모든 project는 `pnpm-workspace.yaml`의 `apps/*`, `packages/*`에 포함되며 공통 버전은 catalog에서
관리한다. Root는 orchestration만 담당하고 앱별 runtime dependency는 각 package manifest가
소유한다.

## Runtime 지도

```text
Installed desktop
Electron main
  -> bundled server.cjs child process
       -> local Fastify + SQLite(userData)
  -> Claude/Codex CLI
  -> BrowserWindow
       -> React renderer
       -> preload의 좁은 OS bridge

Browser development
Vite renderer -> local Fastify -> Claude/Codex CLI
```

Runtime의 작업 디렉터리는 Task의 `projectId` 하나로 결정한다. 프로젝트를 선택한 Task는 등록된
`Project.path`에서 실행해 해당 프로젝트의 Agent 지침, Skill, 설정을 발견한다. 프로젝트를 선택하지 않은
Task는 Electron `userData/general`(개발 server는 별도의 임시 general 경로)에서 실행해 제품 개발 저장소나
다른 프로젝트의 설정이 유입되지 않게 한다. 사용자 홈, 인증, runtime 전역 설정은 변경하지 않는다.
`task`/`agent`/`workspace`의 기존 `workingDirectory`는 호환 데이터일 뿐 실행 fallback으로 사용하지 않으며,
새 API와 UI에서도 더 이상 받지 않는다. 각 `agent_runs` 행은 실행 당시의 `scopeType`(`general` 또는
`project`), project ID와 실제 작업 디렉터리를 기록한다. 첫 run 이후 이 세 값이 달라지면 retry, 변경
요청, 세션 연장, workflow 후속 단계를 거부한다. 프로젝트 경로는 절대 경로만 등록하며 실행 시
`realpath`로 정규화해 symlink 또는 junction 대상 변경도 기존 run snapshot과 다르면 차단한다. 이 CWD
계약은 프로젝트 지침과 기본 작업 문맥을 격리하지만 CWD 밖 파일 접근을 강제하는 sandbox는 아니다.

Run 예약은 SQLite의 동기 transaction 하나에서 workspace 동시 실행 한도 확인, `agent_runs` 삽입,
Task와 workflow 단계 전환, 담당 Agent 변경, 관련 review/activity 저장을 함께 commit한다. 경로·scope·Skill·
prompt처럼 실패 가능한 실행 준비는 transaction 전에 끝내며, event publish와 runtime 시작은 commit 이후에만
수행한다. 예약 시 transaction 안에서 Task의 담당 Agent와 project, Project 경로, workflow가 준비 단계의
snapshot과 같은지 다시 확인하며 Task·Project·workflow 수정도 최신 행과 run 존재 여부를 같은
transaction에서 검증한다. active run이 있는 Task의 담당 Agent는 변경하지 않는다. 메모리의 active run
상태는 타이머와 취소를 위한 runtime 상태이며 예약 가능 여부의 원본이 아니다.

Electron main은 server process의 시작·준비 확인·종료를 소유하지만 Fastify dependency를 import하거나
main ESM bundle에 포함하지 않는다. Production에서는 별도 CommonJS `server.cjs`가 Web build도 제공해
renderer와 API가 같은 임의 loopback origin을 사용한다. 개발에서는 server source, Vite, Electron을
각각 독립 process로 실행하고 Vite proxy가 고정된 local API port로 전달한다. BrowserWindow는
`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`를 유지한다.

저장소는 Electron용 native addon rebuild를 요구하지 않도록 `node:sqlite`를 사용한다. 지원하는
Node/Electron 조합은 SQLite API 포함 여부를 compatibility test에서 확인한다.

## 의존 방향

```text
web --------> domain
web --------> design-system
web --------> pet
design-system -> design-token
desktop - - > server executable (process lifecycle contract)
server -----> domain
server -----> runtime-protocol
runtime spike -> runtime-protocol
```

`domain`과 `runtime-protocol`은 React, Electron, Fastify에 의존하지 않는다. Desktop package도
server package를 코드 dependency로 import하지 않는다. Renderer는 server나 Electron module을
import하지 않는다. OS 기능은 preload가 명시적으로 공개한 메서드만 사용한다.

## Styling 전환 상태

`apps/web/src/styles/*.css`의 feature 스타일과 마지막 `base.css`까지 styled-components로 이관했다.
`design-system.md`가 계획한 대로 `AppGlobalStyles`가 소유하던 공용 utility className을 모두 component로
옮겼다 — `AppGlobalStyles`에는 이제 `button:disabled` reset만 남는다. `Panel`/`Field`/`Fieldset`/`Legend`/
`BackButton`(`.panel`, `.field`, `fieldset`/`legend` 기본 스타일, `.back-button`)은 `packages/design-system`
소유다. `PromptSuggestions`/`TechnicalDetails`/`SectionHeading`/`SectionHeadingCount`/`PageLoading`처럼
여러 feature가 공유하는 조각은 `apps/web/src/shared/ui/`에 둔다. `.office-card`/`.office-loading`/
`.live-badge`(`OfficeCard.tsx`)와 `.office-canvas`(Pixi가 imperative하게 `canvas.className`을 설정하므로
`officeCanvasStyles.ts`의 `createGlobalStyle`로 유지)는 `apps/web/src/features/office/`가 소유한다.

`packages/design-token`이 원시 design token을 소유한다 — semantic `colors`, 4px grid `space`
(`space.x1`~`space.x8`, 실제 레이아웃에 있던 초과값(44/48/56/72px)을 위해 `x11`/`x12`/`x14`/`x18`을
필요한 값만 추가 — 중간 키를 미리 채우지 않는다), `shadow`, `typography`(fontFamily/fontSize/fontWeight/lineHeight),
`animation`(duration/easing), `breakpoints`와 `mediaQuery`(`sm`/`md`/`lg`/`xl`/`2xl`, 기존 425/760/896/
1100/1280 px 값은 유지), `radius`(`xs`/`sm`/`md`/`lg`/`xl`/`pill`/`circle`), `zIndex`를 각각 별 파일로
나누고 `theme.ts`가 `officeTheme` 하나로 합쳐 export한다. React나 styled-components에 의존하지 않는
순수 값 패키지라, 나중에 다른 렌더링 스택(예: Community 웹의 다른 UI 레이어)이 같은 token을 재사용해도
`design-system`의 React/styled-components 의존을 끌고 오지 않는다.

`packages/design-system`(이전 `packages/ui`)은 `packages/design-token`의 공개 API를
`src/tokens.ts`에서 재노출해 web이 `design-token`을 직접 import하지 않고도 `officeTheme`, `colors`,
`mediaQuery` 등을 쓸 수 있게 한다. web은 `@ai-pixel-office/design-system` 하나에만 의존한다.

Radix(`radix-ui`)는 web에서 완전히 제거했다. `Dialog`(`packages/design-system/src/Dialog.tsx`)는
네이티브 `<dialog>`와 `showModal()`/`close()`를 기반으로, `Popover`(`Popover.tsx` +
`usePopoverPosition.ts`)는 네이티브 Popover API(`popover="auto"`, `toggle` 이벤트)와 자체 충돌 보정
위치 계산을 기반으로 구현했다. `FeedbackDialogs`, `TodayPage`의 작업 생성 Dialog, `PixelOffice`의
바로 맡기기 Popover가 이 primitive를 쓴다. Popover의 트리거는 각 caller가 소유하며, `Popover`는
위치 계산과 open/close 상태만 책임진다(화살표 마커는 동적 side 대응 복잡도 대비 가치가 낮아 이번
전환에서 생략했다).

`Popover`의 panel은 `createPortal`로 `document.body`에 렌더링한다 — `PixelOffice`의 `AgentSlot`처럼
`transform`을 쓰는 CSS `animation`이 걸린 조상 안에 두면, 네이티브 Popover API 스펙상 top layer 승격이
그 조상의 stacking context 안에 갇혀버린다. 그러면 형제 `AgentSlot`의 다른 엘리먼트가 popover 위를
덮어서, popover 안의 input을 클릭해도 실제로는 그 엘리먼트가 클릭을 가로채 "바깥 클릭"으로 오인되어
즉시 닫힌다(CDP로 실제 클릭을 재현해 확인한 회귀였다). `Popover`를 어떤 조상 트리에 두든 이 문제가
재발하지 않도록 위치 계산은 그대로 두고 렌더링 위치만 `document.body`로 옮겨 top layer 승격을
보장한다.

색상은 실제 UI 역할에 따라 `brand`, `background`, `text`, `semantic`, `status`, `priority`, `runtime`,
`border`, `shadow`, `action`, `overlay`로 구분한다. styled-component와 `AppGlobalStyles`는 theme token을
직접 참조한다. 반투명 색은 `rgb(... / %)` 대신 8자리 hex(`RRGGBBAA`)로 alpha를 박아 넣는다(기존
`colors.shadow.glow` 컨벤션) — `colors.overlay.scrim`(Dialog backdrop), `colors.shadow.dialog`/
`shadow.snackbar`, `colors.background.surfaceTranslucent`/`background.actionTranslucent`가 그 예다.
원본 색상이 이미 다른 token과 같은 hex라면(`colors.brand.secondaryTint` = `brand.secondary` + alpha처럼)
값을 복제하지 않고 그 token에서 파생시킨다. 픽셀 캔버스와 pet처럼 콘텐츠 자체를 구성하는 에셋 팔레트는
UI theme 색상과 수명이 다르므로 `packages/pet`에서 독립적으로 소유하고, `PixelOffice`의 캐릭터
카드·칩처럼 오피스 화면 전용 색(hex와 반투명 `rgb()` 둘 다)도 같은 이유로 theme token 대상에서 제외한다
— 이 파일은 이미 `#4b4541`류 리터럴을 전역적으로 쓰고 있어 UI chrome이 아니라 콘텐츠 데이터로
취급한다.

`packages/pet`은 펫 카탈로그와 픽셀 스프라이트를 단일 공개 API로 제공한다. `createPet()`이 반환하는
`PetActor`는 `move`, `tick`, `stop`, `snapshot`으로 이동 상태를 관리하며 React, Pixi, Canvas에 의존하지
않는다. web의 Canvas와 Pixi 코드는 이 상태와 픽셀 plot 결과를 각 렌더러 명령으로 변환한다.

`packages/design-system`은 그 token을 주입받아 소비하는 component만 소유한다.

- `Button`(`$variant` + `$fullWidth`), `IconButton`(`$size` + `$tone`) — 공용 컴포넌트를 만들 때 크기 축
  중 어떤 게 variant로 고정되고 어떤 게 caller가 바꿔야 하는 축인지 구분한다. `Button`은 높이는
  `min-height`로 고정하고 너비만 `$fullWidth`로 가변(auto ↔ 100%), `IconButton`은 정사각형이라 `$size`
  하나가 두 축을 함께 결정한다. `apps/web` 전체 43곳의 리터럴 `className="primary-button"` 등을
  전부 `Button`으로 교체 완료 — `base.css`에는 이제 그 클래스들이 남아 있지 않다.
- `Input`/`TextArea`/`Select`(`Input.tsx`) — 너비, padding, border, focus, disabled와 textarea resize를
  공통 소유한다. `apps/web`의 폼은 raw HTML control 대신 이 primitive를 사용하고, label과 field 배치는
  각 feature 책임으로 둔다.
- `ResetCss`(`ResetCss.tsx`) — 브라우저 기본 스타일 reset(`merchant`의 `@repo/ui-kit` `ResetCss`를
  반영)을 `createGlobalStyle`로 소유한다. `apps/web/src/main.tsx`가 `<ThemeProvider>` 안에서
  `<ResetCss />`로 렌더링하며, body 기본 색상/배경/폰트는 `var(--x)` 커스텀 프로퍼티가 아니라
  `theme.*`를 직접 참조한다.
- `Text`/`Label`(`typography.ts`) — `Text.*`는 line-height를 유지해 줄바꿈 가능한 본문에 쓰고,
  `Label.*`(sans, `Button`이 씀)와 `Label.mono`(모노스페이스, 배지/pill류가 향후 쓸 자리)는 둘 다
  line-height를 일부러 뺀다. 아이콘+텍스트가 한 줄에 나란히 있는 버튼/입력/배지는 텍스트 자체의
  line box가 아니라 flex 컨테이너의 `align-items: center`로 정렬해야 정확히 중앙에 맞는다.
  (`Label.md`를 처음에 mono로 잘못 설계해서 버튼 43개의 폰트가 전부 바뀌는 회귀가 났었다 — 배지용
  모노와 버튼용 sans을 같은 토큰으로 뭉뚱그린 게 원인이었다.) `HelperText`는 자체 margin을 갖지 않는다
  — margin은 이 텍스트를 배치하는 부모(예: grid `gap`을 가진 컨테이너, 또는 caller가 만든
  `styled(HelperText)` wrapper)가 문맥에 맞게 책임진다. 처음엔 `margin: -4px 0 15px`로 앞 요소의
  margin과 상쇄하도록 만들어져 있었는데, 앞 요소가 이미 자기 margin-bottom을 갖고 있어서 이중으로
  보정하는 모순이었다.
- `fadeIn`/`popIn`/`slideUpIn`(`animation.ts`) — 여러 화면에서 그대로 반복되던 dialog/snackbar 진입
  keyframes를 하나로 모았다. `duration`/`easing`도 `design-token`에서 재노출한다.
- `icons/`(`TrashIcon`, `CloseIcon`) — 파일마다 따로 박혀 있던 인라인 `<svg>` 아이콘을 컴포넌트로
  뽑았다. 색은 항상 `fill="currentColor"`로 부모 텍스트 색을 따르고, `size` prop만 받는다.

`apps/web`은 자기 앱 전용 레이아웃 조각을 `packages/design-system`이 아니라 `apps/web/src/shared/ui/`에 둔다
(다른 앱이 재사용할 primitive가 아니라 이 앱의 셸/페이지 구조 그 자체이기 때문).

공용 UI 구현은 `common.tsx` 같은 단일 파일에 모으지 않고 `PageHeader.tsx`, `Empty.tsx`,
`ErrorBanner.tsx`, `FullScreenMessage.tsx`처럼 컴포넌트별 파일로 둔다. `padding`, `gap`, `margin`은
4px grid를 사용하고 그림자 offset은 이 규칙에서 제외한다. overlay 계층은 숫자를 직접 쓰지 않고
`theme.zIndex`의 역할별 토큰을 사용한다.

- `Sidebar.tsx` — 사이드바 전체(브랜드, 런타임 상태, workspace chip, nav, note)를 소유하는 독립
  컴포넌트. `App.tsx`는 `workspace`/`runtimeStatus`만 넘긴다.
- `BaseLayout.tsx` — padding/max-width 프레임 하나만 가진 얇은 wrapper. **App 셸이 아니라 각 페이지가
  자기 콘텐츠를 감쌀 때 쓴다** — 8개 페이지(TodayPage/ProjectsPage/ProjectDetailPage/AgentsPage/
  AgentDetailPage/SkillsPage/SettingsPage/TaskDetailPage)가 각자 `<BaseLayout>`으로 감싼다. 이렇게
  페이지 쪽에 둔 이유: App 셸 레벨에서 감싸버리면 나중에 풀스크린이나 자체 sticky 영역이 필요한
  화면이 이 padding을 벗어날 방법이 없어진다. `FullScreenMessage`(로딩/에러 풀스크린 상태)는
  의도적으로 `BaseLayout` 밖에 둔다.
- `App.tsx`의 `AppShell`은 이제 `Sidebar` + grid-column 배치만 하는 얇은 `Shell`/`Content`
  컨테이너다 — padding 로직은 전혀 없다.

아직 남은 일: `Dialog`/`Popover`의 동작 계약(controlled open, focus 복원, 충돌 보정 등)을 지켜주는
component test가 없다 — jsdom/testing-library 도입 방향은 `ai-docs/adr/004-component-test-library.md`에
제안만 해 뒀고 실제 구현은 하지 않았다.

## Community 목표 구조

Community 구현을 시작할 때 다음 실제 계약이 생기는 순서로 package를 추가한다.

```text
packages/package-format   manifest, hash, provenance, fixture/output contract
packages/community-client registry wire contract와 client
apps/community            hosted Explore/Publish UI와 registry API
```

현재는 package format과 runtime security gate가 구현되지 않았으므로 빈 `apps/community`를 만들지
않는다. 자세한 제품 순서는 `plan/community-plan-v2.md`가 소유한다.
