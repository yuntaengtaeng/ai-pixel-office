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

스킬은 앱 데이터 폴더의 라이브러리(`userData/library/skills/<id>/SKILL.md`, 개발 모드는 general 폴더 옆 `library`)에
있다. 실행할 때마다 담당 Agent의 스킬만 복사한 실행용 plugin 폴더를 만들어 Claude에는 Agent SDK `plugins`로,
Codex에는 app-server `skills/extraRoots/set`으로 전달하고 실행이 끝나면 지운다. 앱과 함께 배포되는 Team 패키지는
`apps/server/resources/teams/`에 있고 패키징 시 `resources/teams`로 복사된다. DB의 `PRAGMA user_version`이 앱
데이터 구조 버전이며, 더 낮은 버전으로 만든 DB는 열 때 초기화하고 앱 소유 폴더도 한 번 비운다
([ADR 014](./adr/014-native-skill-and-team-packages.md)).

Claude의 대화형 승인 요청은 headless CLI prompt가 아니라 Claude Agent SDK의 `canUseTool` callback으로 받는다. callback은 normalized `permission_requested` event로 변환되어 Task를 `needs_input`으로 전이시키고, 사용자의 allow/deny/cancel 응답을 같은 callback에 반환한다. Codex App Server approval과 Claude callback은 renderer에 직접 노출하지 않고 `runtime-protocol`과 approval activity metadata를 거친다.

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

Runtime의 작업 디렉터리는 Task의 `projectId` 하나로 결정한다. 프로젝트를 선택한 Task는 Git 저장소면
기안서마다 앱 데이터 아래 작업 공간(`workspaces/<projectId>/<taskId>`, git worktree)에서 실행하고, 결재할 때만
변경을 `Project.path`에 커밋 없이 반영한다([ADR 019](./adr/019-isolated-request-workspaces.md)). Git 저장소가
아니거나 이 방식 이전에 프로젝트 폴더에서 직접 실행한 Task는 `Project.path`에서 실행한다. 어느 쪽이든 해당
프로젝트의 Agent 지침, Skill, 설정을 발견한다. 프로젝트를 선택하지 않은
Task는 Electron `userData/general`(개발 server는 별도의 임시 general 경로)에서 실행해 제품 개발 저장소나
다른 프로젝트의 설정이 유입되지 않게 한다. 사용자 홈, 인증, runtime 전역 설정은 변경하지 않는다.
패키징된 앱의 runtime JSONL 로그는 프로세스 현재 디렉터리의 상대경로가 아니라 Electron이 전달한
`userData/runtime-logs` 절대경로에 저장한다. 개발 server는 general 폴더 아래 `.runtime-logs`를 사용한다.
`task`/`agent`/`workspace`의 기존 `workingDirectory`는 호환 데이터일 뿐 실행 fallback으로 사용하지 않으며,
새 API와 UI에서도 더 이상 받지 않는다. 각 `agent_runs` 행은 실행 당시의 `scopeType`(`general` 또는
`project`), project ID와 실제 작업 디렉터리를 기록한다. 종료된 runtime session을 명시적으로 재개한
Run은 `resumedFromRunId`로 출발 Run도 보존한다. 첫 run 이후 이 세 값이 달라지면 retry, 변경
요청, 세션 연장을 거부한다. 프로젝트 경로는 절대 경로만 등록하며 실행 시
`realpath`로 정규화해 symlink 또는 junction 대상 변경도 기존 run snapshot과 다르면 차단한다. 이 CWD
계약은 프로젝트 지침과 기본 작업 문맥을 격리하지만 CWD 밖 파일 접근을 강제하는 sandbox는 아니다.

Run 예약은 SQLite의 동기 transaction 하나에서 workspace 동시 실행 한도 확인, `agent_runs` 삽입,
Task 상태 전환, 담당 Agent 변경, 관련 review/activity 저장을 함께 commit한다. 경로·scope·Skill·
prompt처럼 실패 가능한 실행 준비는 transaction 전에 끝내며, event publish와 runtime 시작은 commit 이후에만
수행한다. 예약 시 transaction 안에서 Task의 담당 Agent와 project, Project 경로가 준비 때의
snapshot과 같은지 다시 확인하며 Task·Project 수정도 최신 행과 run 존재 여부를 같은
transaction에서 검증한다. active run이 있는 Task의 담당 Agent는 변경하지 않는다. 메모리의 active run
상태는 타이머와 취소를 위한 runtime 상태이며 예약 가능 여부의 원본이 아니다.

Electron main은 server process의 시작·준비 확인·종료를 소유하지만 Fastify dependency를 import하거나
main ESM bundle에 포함하지 않는다. Production에서는 별도 CommonJS `server.cjs`가 Web build도 제공해
renderer와 API가 같은 임의 loopback origin을 사용한다. 개발에서는 server source, Vite, Electron을
각각 독립 process로 실행하고 Vite proxy가 고정된 local API port로 전달한다. BrowserWindow는
`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`를 유지한다.

저장소는 Electron용 native addon rebuild를 요구하지 않도록 `node:sqlite`를 사용한다. 지원하는
Node/Electron 조합은 SQLite API 포함 여부를 compatibility test에서 확인한다.

Settings의 로컬 데이터 관리는 앱 소유 범위만 대상으로 한다. 용량은 SQLite, runtime log,
`general` 작업 폴더와 Task 첨부를 집계한다. 완료 Task 정리는 해당 Task의 실행 이력과 첨부를 함께
삭제하고, 앱 데이터 초기화는 모든 workspace와 앱 소유 `general`/runtime-log 데이터를 삭제한다.
어떤 정리 동작도 사용자가 연결한 Project 폴더와 그 안의 원본 파일을 삭제하지 않는다. 진행 중이거나
승인을 기다리는 Task가 있으면 전체 초기화를 거부한다. 전체 초기화가 성공하면 renderer의 로컬 작성·
온보딩 상태를 지우고 Electron main의 좁은 relaunch IPC를 통해 API child process를 정리한 뒤 앱을
재시작한다. 브라우저 개발 모드에서는 renderer reload로 대체한다.

## Server 모듈 지도

```text
apps/server/src/
  orchestrator.ts             Task 명령(API), run 예약·실행·종료, runtime event 처리
  request-lifecycle.ts        기안서 흐름 (run 판단 결과 적용, 결재 반영, 겹침 맞추기, 작업 공간 정리)
  request-queue.ts            순서 대기 (같은 프로젝트 폴더가 비면 먼저 기다린 기안서부터 이어감)
  lead/project-lead.ts        프로젝트 팀장 (대화, 계획서 결재·반려, 결재하면 기안서를 만들어 맡김)
  lead/lead-plan.ts           팀장이 보고한 계획서 읽기와 검증
  lead/lead-prompt.ts         팀장 지시와 지금 상황 (동료, 진행 중인 기안서, 팀 안내)
  execution-scope.ts          Task의 실행 범위와 경로 결정 (general, 프로젝트 폴더, 기록된 기안서 작업 공간)
  run-prompts.ts              run 지침 문구 (세션 이어가기, 반려, 확인 실패, 첨부, 참고 문서)
  task-document-generator.ts  실행 기록을 팀 문서로 정리
  request-engine/             기안서 진행 판단 (순수 로직)
    output-contract.ts          결과 형식 검사, 결과 블록 해석
    run-decision.ts             run이 끝난 뒤 다음 행동 (ADR 012 4절 + ADR 018 3절)
    verification.ts             확인 명령 판별, 확인 방법·준비 명령 제안
    run-facts.ts                runtime event에서 판단용 사실 수집
    run-guidance.ts             동료 지침에 덧붙일 프로젝트 메모, 확인 방법, 앞 기안 결과, 결과 형식
    plan-order.ts               계획서 기안서 중 앞 기안이 끝나 시작할 수 있는 것
  request-workspace.ts        작업 공간 Git 조작 (만들기, 변경 목록, 반영, 버리기)
  request-workspace-service.ts 작업 공간 주소·준비 명령(취소, 프로세스 트리 종료)·시작 시 정리
  project-snapshot.ts, git.ts 저장소 찾기(Git 오류는 예외), 상태 스냅샷, Git 실행
  loopback-host.ts            로컬 API는 이 컴퓨터를 가리키는 Host 요청만 받음
  repository/request-workspaces.ts  기안서가 작업 공간에서 실행하기로 정해진 사실 기록
```

판단은 `request-engine/`의 순수 함수가 하고, Orchestrator가 모은 사실로 `RequestLifecycle`이 질문, 되돌려 보내기,
결재 대기, 완료 같은 흐름을 진행한다. 기안서 하나는 동료 한 명의 일이며 여러 동료를 엮는 일은 프로젝트 팀장의 계획서로
나눈다([ADR 020](./adr/020-project-lead-delegation.md)). 한 번 작업 공간을 만든 기안서는 `request_workspaces`의 기록으로 주소를 정하므로,
나중에 Git을 읽지 못해도 조용히 격리 없이 실행하거나 반영 없이 완료하지 않는다. 서버와 화면이 함께 쓰는 상태값 목록(`TASK_STATUSES`, `RESULT_FORMATS`,
`AWAITING_USER_STATUSES`)은 `packages/domain`에 두고 타입은 그 목록에서 파생한다.

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
