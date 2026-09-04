# ADR 005: 프로젝트 경험은 사용자가 명시적으로 연결한 workspace에만 적용한다

## 상태

Accepted — 2026-09-05

구현됨 — Task의 `projectId`를 명시적 scope 선택으로 사용하고, project가 없으면 앱 전용 general 실행
경로를 사용한다. `agent_runs.scope_type`과 `working_directory`가 실행 당시 계약을 보존한다.

## 맥락

AI Pixel Office는 Electron 설치형 앱이다. 개발 중에는 저장소 루트에서 앱과 Agent runtime을
실행하므로 현재 작업 디렉터리에 있는 `AGENTS.md`, `CLAUDE.md`, `ai-docs/`, 프로젝트 전용 Skill이
발견될 수 있다. 그러나 설치된 앱의 실행 위치나 개발 저장소는 최종 사용자가 작업 대상으로 선택한
프로젝트가 아니다.

앱 설치만으로 AI Pixel Office 개발에 사용한 지침과 Skill을 모든 사용자 대화에 적용하면 다음 문제가
생긴다.

- 일반 대화에도 제품 개발자의 프로젝트 규칙과 작업 방식이 노출된다.
- 개발 모드와 패키징된 앱에서 process current working directory가 달라 경험을 재현하기 어렵다.
- 사용자가 어떤 프로젝트의 지침과 파일 접근을 허용했는지 알기 어렵다.
- 동일한 프로젝트를 연 사용자에게는 같은 경험을 제공하면서도, 프로젝트를 열지 않은 사용자에게는
  불필요한 경험을 강제하게 된다.

따라서 앱의 공통 제품 경험과 사용자가 선택한 프로젝트 경험을 별도의 scope로 모델링해야 한다.

## 결정

대화는 `general` 또는 `workspace` scope를 명시적으로 가진다.

```ts
type ConversationScope = { type: "general" } | { type: "workspace"; rootPath: string };
```

- `general` 대화에는 앱에 번들된 제품 기본 동작과 사용자 전역 설정만 적용한다.
- `workspace` 대화는 사용자가 폴더 선택기 또는 동등하게 명시적인 동작으로 연결한 `rootPath`에만
  결합한다. 이때 제품 기본 동작에 더해 해당 workspace의 Agent 지침, Skill, 설정을 발견하고 적용한다.
- 앱 설치, 앱 실행 위치, Electron main/server process의 current working directory는 workspace 선택으로
  간주하지 않는다.
- AI Pixel Office 자체의 `AGENTS.md`, `CLAUDE.md`, `ai-docs/`와 개발용 Skill은 제품 개발 계약이며
  설치된 앱의 기본 사용자 경험으로 암묵적으로 주입하지 않는다.
- 프로젝트 경험은 가능한 한 저장소와 함께 이동하는 로컬 설정을 단일 원본으로 삼는다. Codex와 Claude
  등 runtime별 파일 형식이 다르면 얇은 adapter 파일로 같은 canonical 문서를 참조한다.
- 새 대화는 scope를 저장하며 UI는 현재 연결된 workspace를 명확히 표시한다. 최근 workspace를 다시
  여는 기능이 있더라도 저장된 명시적 선택을 복원하는 것이며 process 경로에서 추론하지 않는다.
- workspace 연결을 해제하면 이후 새 대화는 `general`로 시작한다. 기존 대화의 scope 변경 정책은
  구현 시 대화 기록 및 권한 모델과 함께 정의하되 다른 workspace의 지침을 자동 승계하지 않는다.
- 현재 Task 기반 실행에서는 `projectId`가 있으면 `workspace`, 없으면 `general` scope로 해석한다.
  `task`/`agent`/`workspace`의 `workingDirectory`를 fallback 체인으로 사용하지 않는다.
- 프로젝트 경로는 절대 경로만 허용하고 실행 시 실제 경로로 정규화한다. 첫 실행 이후 Task의 project와
  Project의 경로를 잠가 같은 논리 세션이 다른 실행 문맥으로 이어지는 것을 막는다. 연결된 Task가 있는
  Project도 삭제하지 않는다.
- general scope는 앱이 관리하는 안정적인 전용 디렉터리에서 실행한다. AI Pixel Office는 별도 메모리
  저장소나 runtime 간 메모리 동기화를 구현하지 않고 Codex/Claude가 해당 실행 경로와 사용자 전역
  설정에서 제공하는 동작을 그대로 사용한다.

## 결과

- 같은 저장소를 명시적으로 연결한 사용자는 저장소에 포함된 지침과 Skill을 통해 재현 가능한 프로젝트
  경험을 얻는다.
- 프로젝트를 연결하지 않은 사용자는 AI Pixel Office의 일반 제품 경험만 받는다.
- 폴더 선택이 프로젝트 지침, Skill 탐색과 기본 작업 문맥에 대한 명시적인 opt-in 경계가 된다. CWD는
  자체로 파일 접근 sandbox가 아니며 CWD 밖 접근 강제는 runtime별 capability와 권한 정책이 소유한다.
- 대화, runtime 실행, 권한 승인, Skill 탐색 API는 현재 workspace scope를 전달하고 검증해야 한다.
- 개발 모드에서도 저장소 CWD가 자동으로 사용자 workspace가 되지 않으므로 개발용 기본 workspace가
  필요하면 fixture 또는 명시적 설정으로 제공해야 한다.
- runtime별 지침 탐색 규칙이 완전히 같지 않으므로 동일 경험은 파일 이름의 일치가 아니라 canonical
  지침을 참조하는 adapter와 scope 계약으로 보장한다.

## 재검토 조건

- 제품이 항상 하나의 고정 workspace만 여는 전용 도구로 바뀌는 경우
- OS 파일 연결이나 CLI의 명시적 경로 인자가 폴더 선택기와 동일한 사용자 의사 표시로 정의되는 경우
- runtime 자체가 안전하고 검증 가능한 공통 workspace manifest 표준을 제공하는 경우
- 여러 workspace를 동시에 결합해야 하는 요구가 생기는 경우에는 단일 `rootPath` 모델과 지침 충돌
  우선순위를 별도 ADR로 재검토한다.
