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
패키징된 앱의 runtime JSONL 로그는 프로세스 현재 디렉터리의 상대경로가 아니라 Electron이 전달한
`userData/runtime-logs` 절대경로에 저장한다. 개발 server는 general 폴더 아래 `.runtime-logs`를 사용한다.
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
server -----> pet
runtime spike -> runtime-protocol
```

`domain`과 `runtime-protocol`은 React, Electron, Fastify에 의존하지 않는다. Desktop package도
server package를 코드 dependency로 import하지 않는다. Renderer는 server나 Electron module을
import하지 않는다. OS 기능은 preload가 명시적으로 공개한 메서드만 사용한다.

## Frontend styling과 구조

`apps/web`의 styled-components/design-token 경계, 색상 규칙, `Dialog`/`Popover` 구현은
[`ai-docs/design-system.md`](./design-system.md)가 소유한다. `apps/web/src/features/<feature>`
폴더 구성 규칙은 [`ai-docs/frontend-structure.md`](./frontend-structure.md)가 소유한다.

## Community 목표 구조

Community 구현을 시작할 때 다음 실제 계약이 생기는 순서로 package를 추가한다.

```text
packages/package-format   manifest, hash, provenance, fixture/output contract
packages/community-client registry wire contract와 client
apps/community            hosted Explore/Publish UI와 registry API
```

현재는 package format과 runtime security gate가 구현되지 않았으므로 빈 `apps/community`를 만들지
않는다. 자세한 제품 순서는 `plan/community-plan-v2.md`가 소유한다.
