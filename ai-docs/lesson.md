# 작업 교훈

이 문서는 실제 작업 중 잘못된 판단이나 반복 비용이 발생한 사례를 다음 작업자가 재현하지 않도록
기록한다. 현재 구조의 정답은 `architecture.md`와 ADR이 소유하며, 여기서는 판단 과정과 검증 순서를
다룬다.

## 2026-09-04 — Electron/Fastify process boundary

### 아쉬웠던 점

1. 사용자의 성공 기준은 `pnpm run dev` 한 번으로 API, Web, Electron 창이 모두 뜨는 것이었는데,
   초기에 package build 검증을 먼저 제안했다. 생성 번들 오류를 확인할 필요는 있었지만 dev 성공을
   먼저 증명했어야 했다.
2. `node:sqlite` import 오류를 처음에는 개별 번들 변환 문제로만 보고 우회했다. 이어서
   `@fastify/static`의 `require("path")`가 실패한 뒤에야 Fastify 전체를 Electron ESM main에 넣은
   process boundary가 근본 원인임을 확정했다. 첫 오류에서 main bundle의 크기와 포함 dependency를
   검사했으면 반복을 줄일 수 있었다.
3. 실행 중이거나 파일 핸들이 남은 Electron 설치 위에서 `pnpm install --force`를 시도했다. Windows가
   Electron 파일을 잠근 상태에서 설치가 중단되며 `checksums.json`, CLI와 runtime 일부가 빠진
   불완전한 `node_modules`가 만들어졌다. 생성 dependency 복구가 실제 구조 변경보다 더 오래 걸렸다.
4. sandbox의 esbuild 접근 오류와 프로젝트 코드 오류를 분리해 설명하는 시점이 늦었다. 같은 명령의
   실패라도 filesystem 권한, package 설치, source compile, runtime launch를 각각 구분해야 한다.

### 다음 작업의 원칙

- 사용자가 말한 가장 짧은 성공 경로를 첫 acceptance test로 둔다. 이 프로젝트의 desktop 변경은
  `pnpm run dev`로 API health, Web 응답, Electron window handle까지 확인한 뒤 production build를
  검증한다.
- Electron main에는 window lifecycle, OS integration과 child process 관리만 둔다. Fastify처럼
  CommonJS dependency graph가 큰 서비스는 별도 실행 파일로 빌드하고 main ESM bundle에 포함하지
  않는다.
- 첫 module-resolution 오류에서 임시 alias나 import 우회를 추가하기 전에 build artifact를 검색한다.
  Electron main에 `fastify`, `@fastify/static`, server repository 코드가 포함됐다면 경계가 잘못된 것이다.
- `node_modules`를 다시 구성하기 전 관련 dev process와 파일 잠금을 먼저 확인한다. 실행 중인 Electron이
  있으면 종료하고, lockfile만 바꿀 때는 `pnpm install --lockfile-only`를 우선한다. `--force`는 생성
  폴더 전체를 교체해야 하는 근거와 중단 없는 실행 환경이 있을 때만 사용한다.
- package manager가 `node_modules`를 변경하는 동안 명령을 중단하지 않는다. 불가피하게 중단됐다면
  source 오류를 디버깅하기 전에 package completeness부터 확인한다.
- 검증 순서는 다음을 기본으로 한다.

```text
pnpm run dev acceptance
  -> typecheck와 test
  -> build artifact boundary 검사
  -> build:desktop
  -> release 작업일 때만 package:desktop
```

### 유지해야 할 회귀 조건

- 개발 모드에서 server, Vite, Electron은 독립 process로 표시되어야 한다.
- `apps/desktop/dist/main.js`는 Fastify나 server 구현을 포함하지 않아야 한다.
- production `server.cjs`는 Electron main과 별도로 실행되고 ready/shutdown 메시지 계약을 지켜야 한다.
- Electron 종료 시 child server가 함께 종료되어야 한다.

## 2026-09-09 — ESM SDK를 CJS server bundle에 포함할 때의 import.meta

### 아쉬웠던 점

Claude Agent SDK는 module 초기화 중 `createRequire(import.meta.url)`을 사용한다. 개발 서버는 ESM
source를 직접 실행해 정상 동작했지만, 모든 dependency를 포함하는 설치용 CJS bundle에서는 esbuild가
`import.meta`를 빈 객체로 바꿔 macOS DMG의 local server가 시작 전에 종료됐다.

### 다음 작업의 원칙

- ESM dependency를 설치용 CJS server에 새로 포함하면 source/dev 실행만으로 검증하지 않는다.
- ESM SDK는 CJS bundle에 합치지 말고 package.json과 플랫폼별 dependency를 extraResources로 함께
  패키징하며, 서버에서는 dynamic import로 로드한다.
- `build:desktop` 성공뿐 아니라 생성된 `server.cjs`를 직접 시작해 API ready 상태까지 확인한다.

## 2026-09-09 — extraResources가 pnpm symlink를 그대로 복사함

### 아쉬웠던 점

`@anthropic-ai/claude-agent-sdk`를 CJS bundle 밖으로 빼고 `extraResources`로
`apps/server/node_modules/@anthropic-ai`를 복사하도록 고쳤지만(같은 날 앞선 커밋), 그 경로는 pnpm이
만든 symlink이고 실제 대상은 빌드 머신의 절대경로(`.../node_modules/.pnpm/...`)를 가리킨다.
electron-builder의 `extraResources` 복사는 이 symlink를 dereference하지 않고 그대로 패키지에
넣는다. 그 결과 빌드한 Windows 머신에서는 파일이 그 자리에 있으니 dev/typecheck로는 문제를 못
잡았고, 실제로 다른 머신(macOS DMG)에 설치한 뒤에야 `Cannot find package
'@anthropic-ai/claude-agent-sdk'`로 실패했다.

### 다음 작업의 원칙

- pnpm monorepo에서 `node_modules` 하위 경로를 `extraResources`나 다른 패키징 복사 대상으로 쓸 때는
  그 경로가 symlink인지 먼저 확인한다(`ls -la` 또는 `readlink`). symlink라면 복사 도구가
  dereference하는지 검증하지 않고 넘어가지 않는다.
- 이런 복사는 빌드 머신에서 `server.cjs`를 직접 실행하는 것만으로는 검증되지 않는다. symlink는 빌드
  머신 위에서는 항상 유효하기 때문이다. 패키지 결과물(`release/**/resources/...`) 안의 대상 파일이
  실제 파일인지 symlink인지 `file`/`ls -la`로 직접 확인해야 한다.
- 해결책은 패키징 전에 실제 파일을 dereference해 별도 폴더로 복사(`fs.cpSync(src, dest, {
  dereference: true }))하고, `extraResources`는 그 폴더를 가리키게 하는 것이다
  (`apps/desktop/scripts/prepare-sdk-resource.mjs`).
- (같은 날 이어진 문제) 위 dereference 수정만으로는 부족했다. `@anthropic-ai/claude-agent-sdk`의
  플랫폼별 네이티브 바이너리(optionalDependency, 예: `claude-agent-sdk-win32-x64`)는
  `apps/server/node_modules/@anthropic-ai`가 아니라 `claude-agent-sdk` symlink가 실제로 가리키는
  pnpm 저장소 안의 `@anthropic-ai/` 폴더에 형제(sibling)로 linking된다. 얕은 workspace
  `node_modules/@anthropic-ai`만 복사하면 이 형제 바이너리 패키지가 통째로 빠져 런타임에
  "Native CLI binary for <platform> not found"로 실패한다(에러 메시지가 원래 뭉뚱그려져 있어서
  `apps/server/src/colleague-fit.ts`가 runtime `failed` 이벤트의 실제 error를 던지도록 먼저 고친
  뒤에야 원인을 특정할 수 있었다). 복사 소스는 `realpathSync`로 resolve한 `claude-agent-sdk`의
  부모 `@anthropic-ai/` 디렉터리여야 한다.
- 이 optionalDependency는 빌드 머신의 OS/arch에 맞는 것만 pnpm이 설치하므로, macOS DMG는 macOS
  머신에서 `pnpm install` 후 패키징해야 한다. Windows에서 크로스 빌드한 mac 패키지는 darwin 바이너리
  자체가 로컬에 없어 이 방식으로 고칠 수 없다.

## 2026-09-09 — GUI로 실행한 macOS 앱에서만 Claude SDK 실행이 실패함

### 아쉬웠던 점

터미널에서 앱 바이너리를 직접 실행하면 온보딩의 "AI로 동료 추천 받기"가 되는데, DMG로 설치해
Finder/Dock으로 실행하면 실패했다. `scripts/runtime-spike/process.ts`의 `runtimeEnvironment()`는
macOS/Linux에서 `$SHELL -ilc`로 로그인 셸을 한 번 실행해 `.zshrc`/`.zprofile`이 설정하는
PATH(Homebrew, nvm/volta 등)를 읽어와 병합한다 — GUI로 실행된 앱은 launchd가 주는 최소 PATH만
갖고, 셸 rc 파일을 전혀 안 읽기 때문이다. `spawnClaude`/`spawnCodex`/`runtimeVersion`/
`system-status.ts`의 `runCli`는 전부 이 보정된 환경을 넘기는데, 정작 온보딩이 실제로 호출하는
`ClaudeRuntimeAdapter.runWithSdk`(`apps/server/src/runtime/claude.ts`)의 SDK `query()` 호출에는
`env`를 안 넘기고 있었다. SDK 문서(`sdk.d.ts`)에 `env`를 생략하면 `process.env`를 그대로
상속한다고 명시돼 있어, 이 경로만 GUI 실행의 최소 PATH를 그대로 물려받았다. "설정" 화면의
Claude/Codex 버전·로그인 상태 체크는 모두 정상으로 보이는데 실제 에이전트 실행만 실패하는
정황과 정확히 일치했다.

### 다음 작업의 원칙

- 자식 프로세스를 스폰하거나 PATH에 의존하는 SDK를 호출하는 새 경로를 추가할 때는, 같은 런타임을
  부르는 기존 경로(`spawnClaude`, `spawnCodex`, `runtimeVersion`, `runCli`)가 전부
  `runtimeEnvironment()`를 넘기고 있는지 grep으로 확인하고 빠짐없이 맞춘다.
- "설정 화면의 상태 체크는 성공하는데 실제 실행만 실패한다"는 정황은 두 경로가 서로 다른 환경/설정을
  쓰고 있다는 강한 신호다. 실패하는 경로 하나만 보지 말고 같은 기능의 다른 경로와 비교한다.
- macOS PATH 문제는 GUI 실행에서만 재현되고 터미널 실행으로는 재현되지 않는다. "터미널에서는
  되는데 Dock/Finder로 실행하면 안 된다"는 보고는 곧 launchd의 최소 PATH를 의심할 신호다.

## 2026-09-04 — Label 토큰을 mono로 잘못 설계

### 아쉬웠던 점

`packages/design-system`의 `Label.md`를 처음에 모노스페이스로 설계했다. 배지·pill류가 모노스페이스를
쓸 거라는 예상만으로 `Button`이 소비하는 sans 텍스트용 토큰과 배지용 모노 토큰을 하나로 묶은 것이
원인이었다. `Button`이 `Label.md`를 쓰고 있었기 때문에 이 결정 하나로 `apps/web` 전체 버튼 43개의
폰트가 한꺼번에 모노스페이스로 바뀌는 회귀가 났다.

### 다음 작업의 원칙

- 폰트 패밀리처럼 화면 전반에 영향을 주는 design token은 이름(`Label.md`)이 아니라 실제 소비처를
  먼저 확인하고 값을 정한다. "배지에 어울릴 것 같다"는 예상 용도로 공용 토큰의 기본값을 정하지
  않는다.
- 공용 typography 토큰을 바꿀 때는 그 토큰을 쓰는 컴포넌트 목록을 먼저 grep해 영향 범위를
  확인한다.

### 유지해야 할 회귀 조건

- `Label.md`(sans, `Button`이 소비)와 `Label.mono`(모노스페이스, 배지/pill류)는 서로 다른 토큰으로
  유지되어야 한다.

## 2026-09-05 — Popover가 조상 stacking context에 갇히는 회귀

### 아쉬웠던 점

`PixelOffice`의 `AgentSlot`처럼 `transform`을 쓰는 CSS `animation`이 걸린 조상 안에 `Popover`의
panel을 그대로 렌더링했다. 네이티브 Popover API(`popover="auto"`) 스펙상 top layer 승격이 그 조상의
stacking context 안에 갇혀버려서, 형제 `AgentSlot`의 다른 엘리먼트가 popover 위를 시각적으로 덮었다.
그 결과 popover 안의 input을 클릭해도 실제로는 덮고 있던 엘리먼트가 클릭을 가로채 "바깥 클릭"으로
오인되어 popover가 즉시 닫혔다. 렌더링 순서와 z-index만 봐서는 원인이 보이지 않았고, CDP로 실제
클릭을 재현해서야 확정할 수 있었다.

### 다음 작업의 원칙

- 네이티브 Popover API나 `<dialog>`처럼 top layer 승격에 의존하는 요소는 `transform`이 걸린 조상
  안에 두면 안 된다. 의심되면 렌더링 위치를 `document.body`로 옮겨 재현되는지 먼저 확인한다.
- "닫혀야 할 때 안 닫힌다"가 아니라 "열려 있어야 할 때 닫힌다"류의 버그는 이벤트 리스너 로직보다
  stacking context/top layer 문제를 먼저 의심한다. DevTools의 Elements 패널 z-index만으로는
  안 보이므로 CDP나 실제 클릭 좌표 재현이 필요할 수 있다.

### 유지해야 할 회귀 조건

- `Popover`의 panel은 `createPortal`로 `document.body`에 렌더링되어야 한다. 위치 계산 로직과 이
  렌더링 위치를 분리해서 유지한다.

## 2026-09-05 — HelperText margin 이중 보정

### 아쉬웠던 점

`HelperText`가 처음에 `margin: -4px 0 15px`로 앞 요소의 margin과 상쇄하도록 설계돼 있었다. 그런데
앞 요소가 이미 자기 `margin-bottom`을 갖고 있어서, 두 컴포넌트가 서로 다른 방향으로 같은 간격을
보정하려는 모순이 생겼다. 원본 상태(레이아웃 간격)를 한 컴포넌트가 아니라 두 컴포넌트가 나눠
가지면서 실제 렌더링 결과를 예측하기 어려워졌다.

### 다음 작업의 원칙

- 공용 텍스트/leaf 컴포넌트에 배치 목적의 margin을 기본값으로 넣지 않는다. margin은 그 컴포넌트를
  실제로 배치하는 부모(grid `gap`이 있는 컨테이너, 또는 caller가 만든 wrapper)가 문맥에 맞게
  책임진다.
- 간격이 안 맞는 버그를 고칠 때 반대 방향 margin을 추가해 상쇄하는 방식을 먼저 의심한다. 두
  컴포넌트가 같은 간격을 서로 다르게 보정하고 있지 않은지 확인한 뒤 고친다.

### 유지해야 할 회귀 조건

- `HelperText`는 자체 margin을 갖지 않아야 한다.
