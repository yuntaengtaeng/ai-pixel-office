# ADR 014: Skill과 Team은 런타임 표준 형식의 파일 패키지로 관리하고 런타임에 네이티브로 전달한다

## 상태

Accepted — 2026-10-04

부분 구현(2026-10-04) — 앱 라이브러리, 런타임 네이티브 전달, bundled Product Team 설치가 동작한다. 가져오기·내보내기와
Community는 아직 없다. 런타임 전달 방식은 2026-10-04에 Claude Agent SDK와 Codex app-server로 검증했다(아래 "검증 기록").

## 맥락

현재 Skill은 앱이 소유한 SQLite 행이다(`skills` 테이블). 실행 시 `compileAgentInstructions`가 모든 Skill의
지침을 일반 텍스트로 prompt에 붙인다. 이 방식은 나중에 Community에서 Skill을 공유하고 Team을 만들기 위해
선택했지만 다음 문제가 있다.

- **생태계와 호환되지 않는다.** Claude Code와 Codex는 이미 `SKILL.md` 폴더 형식(이름과 설명 frontmatter +
  지침 + 보조 파일)을 표준으로 쓴다. 앱의 DB Skill은 앱 밖으로 가져갈 수 없고, 사람들이 이미 쓰는 Skill을
  가져올 수도 없다. 공유 Community를 만들려면 오히려 불리하다.
- **런타임의 장점을 버린다.** 네이티브 Skill은 이름과 설명만 먼저 보이고 필요할 때 본문과 보조 파일을 읽는다.
  prompt에 전부 붙이는 방식은 모든 실행에 전체 본문을 넣고, 보조 파일(템플릿, 예시, 스크립트)을 쓸 수 없다.
- **두 Skill 체계가 섞여 있다.** 프로젝트의 `.claude/skills`, `.agents/skills`는 발견해 개수만 보여주고, Claude
  실행의 도구 목록에 `Skill`이 없어 실제로는 호출할 수 없다. 화면은 두 종류를 합친 숫자를 보여준다.
- **계획과도 어긋난다.** `plan/community-plan-v2.md`는 이미 "Skill은 DB row나 prompt 문자열이 아니라" 파일
  패키지라고 정했다. 구현만 DB 방식으로 남았다.
- **프로젝트 설치는 답이 아니다.** 패키지를 사용자 프로젝트에 설치하면 W1의 변경 사실과 되돌리기 대상에
  섞인다([ADR 013](./013-baseline-and-rollback.md)).

Agent Orchestrator(AO)는 자체 Skill 추상화 없이 각 런타임의 네이티브 지침과 Skill을 그대로 쓰고, 앱이 필요한
Skill(`using-ao`)은 앱 데이터 폴더에 두고 런타임에 연결한다. 다만 AO에는 공유 수단이 없다. Pixel Office는
네이티브 방식을 따르되, 그 위에 공유 가능한 패키지 계층을 둔다.

## 결정

### 1. Skill은 표준 `SKILL.md` 폴더다

- Skill 하나는 `<name>/SKILL.md`(frontmatter의 `name`, `description` + 본문)와 선택적 보조 파일로 이루어진 폴더다.
  Claude Code와 Codex가 그대로 읽을 수 있는 형식이며 앱 전용 필드를 본문에 넣지 않는다.
- 앱에만 필요한 정보(필요 권한, 출처, version, 분류)는 같은 폴더의 `pixel-office.json`에 둔다. 이 파일이 없어도
  Skill은 동작한다.
- Skill 본문과 파일은 DB에 저장하지 않는다. 출처(`bundled` / `local` / `imported` / `community`), version,
  분류, 필요 권한은 각 Skill 폴더의 `pixel-office.json`이 가진다. DB는 Agent와 Skill id(폴더 이름)의 연결만 가진다.
  (2026-10-04 구현 시 DB 색인 대신 폴더 메타데이터를 원본으로 정했다. 파일과 DB 사이의 동기화가 필요 없다.)

### 2. 앱 소유 라이브러리

- Skill과 Team은 앱 데이터 폴더의 라이브러리에 둔다(`userData/library/`). 사용자 프로젝트, `~/.claude`,
  `~/.codex`에는 쓰지 않는다.
- 라이브러리의 Skill 묶음은 Claude Code local plugin 형식(`.claude-plugin/plugin.json` + `skills/`)으로 둔다.
  같은 `skills/` 폴더를 Codex의 추가 Skill 경로로도 쓴다.
- `plan/community-plan-v2.md`의 구분을 따른다: 설치본(`bundled`, `community`)은 수정하지 않고, 수정하려면
  `local` 사본(fork)을 만든다.

### 3. 런타임 전달

| 런타임 | 방법                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| Claude | Agent SDK `plugins: [{ type: "local", path }]`로 라이브러리를 연결하고 `skills` 옵션으로 보이는 Skill을 정한다. |
| Codex  | app-server `skills/extraRoots/set`으로 라이브러리 경로를 추가한다.                                              |

- 담당 Agent에 연결된 라이브러리 Skill만 그 실행에 보이게 한다. 런타임이 Skill 단위 필터를 지원하지 않으면
  Agent에 연결된 Skill만 담은 실행용 경로를 만들어 전달한다.
- 프로젝트의 네이티브 Skill과 지침(`.claude/skills`, `.agents/skills`, `CLAUDE.md`, `AGENTS.md`)은
  [ADR 005](./005-explicit-workspace-scope.md)대로 workspace scope에서 런타임이 직접 읽는다. 지금처럼 발견만 하고
  호출할 수 없는 상태는 고친다.
- Skill 지침을 prompt에 붙이는 방식(`compileAgentInstructions`의 Skill 부분)은 네이티브 전달로 대체한다. Agent의
  역할, Task, Workflow 단계 지침은 계속 앱이 만든다.

### 4. Team은 Agent 정의와 Workflow를 묶은 패키지다

- Team 패키지는 `team.yaml`, 역할별 `agents/<role>.md`, 사용하는 Skill 목록(이름과 version), Workflow 단계 정의
  (단계별 담당 역할, 파일 수정 허용, Output Contract — [ADR 012](./012-evidence-based-state.md))로 이루어진다.
  Skill 본문은 Team에 복사하지 않고 이름으로 참조하며, 함께 배포할 Skill은 같은 패키지의 `skills/`에 둔다.
- 형식은 `ai-docs/pixel-office-product-team`의 `local-team-v1`을 일반화해 정한다.
- Team을 "사용"하면 라이브러리에 Team과 Skill을 설치하고, workspace에 Agent 레코드와 Workflow를 만든다.
  Agent 레코드는 출처 Team과 version을 기록해 다시 사용할 때 중복을 만들지 않는다.
- 앱은 W1용 Product Team을 `bundled` Team으로 함께 배포한다([ADR 011](./011-target-user-and-w1.md)).
- [ADR 020](./020-project-lead-delegation.md) 이후 패키지의 Workflow 정의는 실행 순서가 아니라 프로젝트 팀장이 읽는
  "이 팀이 보통 일하는 순서" 안내다.

### 5. 공유

- 내보내기와 가져오기는 폴더(또는 압축 파일) 단위다. 앱에서 만든 Skill은 Claude Code나 Codex에서 그대로 쓸
  수 있고, 그 반대도 가능하다.
- Community registry, 서명, 버전 해석은 `plan/community-plan-v2.md`가 소유한다. 이 ADR은 그 패키지의 본문
  형식을 런타임 표준으로 고정한다.
- 가져온 Skill에 실행 파일이나 스크립트가 있으면 설치 전에 알리고, 기본적으로 지침 전용(community-plan-v2의
  신뢰 수준 1)으로 취급한다.

### 6. 기존 DB Skill 전환

- 기존 `skills` 행은 `local` Skill 폴더로 한 번 변환한다: `name`, `description` → frontmatter, `instructions` →
  본문, `requiredPermissions`·`category`·`tools` → `pixel-office.json`.
- 이름은 폴더 이름 규칙(소문자, 숫자, `-`)으로 바꾸고, 충돌하면 접미사를 붙인다. `agent_skills` 연결과
  `run_skills` 기록은 유지한다.
- AI Skill 초안 기능은 같은 형식의 폴더를 만들도록 바꾼다.

## 검증 기록 (2026-10-04)

- **Claude Agent SDK 0.3.x**: 임시 폴더에 `.claude-plugin/plugin.json`과 `skills/w1-test/SKILL.md`를 만들고
  `plugins: [{ type: "local", path }]`, `skills: ["pixel-office-library:w1-test"]`, `settingSources: []`로
  실행했다. init 메시지에 plugin과 Skill이 나타났고, 모델이 `Skill` 도구로 `pixel-office-library:w1-test`를
  호출해 Skill 본문의 값을 답했다. 실행 폴더에는 아무 파일도 쓰지 않았다.
- **Codex CLI 0.159.2 app-server**: `skills/list`에 없던 Skill이 `skills/extraRoots/set`으로 라이브러리 경로를
  추가한 뒤 나타났다. `~/.codex/config.toml`은 바뀌지 않았다. Codex에서 Skill을 실제로 호출하는 실행과
  Skill 단위 필터 여부는 구현 시 확인한다.

## 결과

- 앱의 Skill은 Claude Code와 Codex 생태계와 같은 형식이 되어, Community가 앱 밖의 Skill과 사용자까지 포함할 수 있다.
- 실행 prompt에서 Skill 본문이 빠지고 필요한 Skill만 런타임이 읽는다.
- Skill 화면은 DB 레코드 편집기가 아니라 라이브러리(설치됨 / 내가 만든 것 / 프로젝트에 있는 것) 화면이 된다.
- `ai-docs/pixel-office-product-team`은 이 저장소 개발용 팀으로 남고, 범용 Skill과 역할은 bundled Product Team의
  원본으로 쓴다(`plan/pixel-office-direction.md` §4.5).
- 런타임의 plugin·Skill API가 바뀌면 adapter가 영향을 받는다. 런타임 capability 확인 대상에 추가한다.

## 재검토 조건

- Claude SDK의 `plugins`/`skills` 옵션이나 Codex의 `skills/extraRoots/set`이 제거되거나 의미가 바뀔 때
- Agent Skills 형식이 런타임 사이에서 갈라져 하나의 폴더로 두 런타임을 지원할 수 없을 때
- Community registry 설계에서 이 형식으로 표현할 수 없는 요구(예: 실행 코드 배포)가 확정될 때
