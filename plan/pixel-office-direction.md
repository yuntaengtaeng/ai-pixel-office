# Pixel Office — Product Direction & Differentiation

> 상태 표기: **현재** = 구현되어 동작함 · **부분** = 일부만 있음 · **목표** = 아직 없음
> 현재 상태는 2026-10-04 기준 코드(`apps/server/src/orchestrator.ts`, `packages/domain`,
> `apps/web/src/features`)와 ADR을 확인해 적었다. 코드와 다르면 코드가 맞다.
>
> 이 문서는 실행 계획이다. 오래 유지해야 하는 결정은 ADR이 소유하고 이 문서는 링크한다.
>
> - [ADR 011 — 대표 Workflow 우선과 W1](../ai-docs/adr/011-target-user-and-w1.md)
> - [ADR 012 — Evidence 기반 상태와 단계 진행](../ai-docs/adr/012-evidence-based-state.md)
> - [ADR 013 — 기준점과 되돌리기](../ai-docs/adr/013-baseline-and-rollback.md)
>
> **2026-10-05 결정 — 작업 공간 격리와 프로젝트 중심 화면.** 이 문서의 기준점(①)과 되돌리기(⑥)는
> [ADR 019](../ai-docs/adr/019-isolated-request-workspaces.md)로 대체한다. 파일을 고치는 기안서는 자기 작업 공간(git worktree)에서
> 실행하고, 결재 = 사용자 폴더에 반영, 기안 취소 = 작업 공간 폐기다. 화면은
> [ADR 017](../ai-docs/adr/017-project-centered-workspace.md)(프로젝트 중심, 메신저를 기안서 대화로 통합, Task Detail 대화 화면),
> 진행 규칙은 [ADR 018](../ai-docs/adr/018-request-run-rules.md)(메시지 전달, 결재는 파일이 바뀐 기안서에만)을 따른다.
> 목표는 Orca, AO 수준의 병렬 오케스트레이션이다.

## 1. 결론

Pixel Office의 큰 방향은 맞다. 다만 지금까지의 로드맵은 Harness의 기술 완성도를 높이는 순서로 짜여 있어,
그대로 가면 **Agent Orchestrator(AO) 수준의 개발자 도구를 만든 뒤 Pixel UI를 입힌 제품**이 될 위험이 있다.

그래서 로드맵의 기준을 바꾼다(ADR 011).

> Pixel Office는 Harness를 먼저 만들고 사용자 경험을 나중에 입히지 않는다.
> 대표 Workflow를 먼저 정의하고, 해당 Workflow를 완성하기 위해 필요한 Harness 기능을 추가한다.

Pixel Office를 한 문장으로 표현하면 다음과 같다.

> **Pixel Office is a desktop workspace where anyone can build and manage an AI team.**

차별점은 Agent를 더 많이 돌리는 것이 아니라, 사용자가 다음 세 질문에 바로 답할 수 있게 만드는 것이다.

1. AI 팀이 **무슨 일을 했는가?**
2. 그 결과를 **믿을 수 있는가?**
3. 지금 **내가 무엇을 해야 하는가?**

---

## 2. 제품 원칙

### 원칙 1. Evidence가 상태의 근거다 — ADR 012

> **Agent가 완료했다고 말함 ≠ 완료**

Task와 단계의 상태는 Agent의 자기 보고가 아니라 실행, 산출물, 변경, 검증, 사람의 판단 같은 **관찰 가능한
사실**로 계산한다. 근거가 없는 항목은 "검증 없음"처럼 비어 있음을 표시한다. 진행 정도는 %가 아니라
`3/5 단계 완료`, `개발 완료 → 검토 필요`처럼 표시한다.

현재: **부분** — Run 상태, 도구 이벤트, 권한 요청, 사용량, 승인/수정 요청 기록은 있다. 그러나 결과는 Agent의
요약문이 중심이고, 변경 파일과 검증 결과는 수집하지 않으며, 마지막 Run이 끝나면 근거와 무관하게
`needs_review`로 전이한다.

### 원칙 2. 사람은 필요할 때만 부른다 — ADR 012

모든 단계 사이에 승인을 넣지 않는다. AI 팀은 근거로 판단할 수 있는 동안 스스로 진행하고, 사용자만 답할 수
있는 질문, 권한 요청, 검증 실패, 사용자가 요청한 확인 지점에서만 사람에게 돌아온다. 그래서 **Human Desk**는
승인 목록이 아니라 사람의 판단이 필요한 일만 모이는 곳이다(§6).

### 원칙 3. UX에서는 Harness를 숨긴다 — ADR 011

Simple Mode는 Git, branch, commit, worktree, CLI, token 같은 구현 용어를 쓰지 않는다. 내부에서 Git 등을 쓰는
것은 괜찮다. Terminal을 숨겨도 원시 권한 요청이 그대로 나오면 의미가 없으므로 권한도 업무 언어로 번역한다(§7).

### 원칙 4. Agent가 아니라 Team을 보여준다

배정은 **추천 + 근거 + 사람의 확정**으로 한다. 점수와 서열에 따른 자동 배정은 하지 않는다(ADR 007과 일치).

```text
이 작업에는 Felix를 추천합니다

근거
- 관련 Skill: React UI 구현
- 최근 비슷한 작업: "로그인 화면 개선" (9/28 승인됨)

[Felix에게 맡기기]  [다른 동료 선택]
```

### 원칙 5. Pixel Office는 상태를 보여주는 계층이지 원본이 아니다

같은 상태를 Office에서만 알 수 있으면 안 된다(§9).

### 원칙 6. Simple by Default, Powerful when Needed

비개발자는 업무와 결과만 보고, 개발자는 필요하면 원시 명령, 변경 내용, 로그, 사용량까지 펼쳐 본다(§8).

### 원칙 7. 대표 Workflow에 집중한다 — ADR 011

새 기능은 **현재 대표 Workflow W1을 완성하는 데 필요한지**로 판단한다. 필요 없으면 W1 완성 이후로 미룬다.

---

## 3. Agent Orchestrator와 Pixel Office

AO는 "AI 코딩 Agent 팀"을 위한 데스크톱 앱이다. Worker 하나는 Task 하나, Agent 하나, 격리된 작업 공간
하나를 가진다. 계획 담당 Orchestrator Agent가 있고, 칸반 상태는 PR / CI / review 사실에서 계산한다.

| 영역 | Agent Orchestrator | Pixel Office |
| --- | --- | --- |
| 핵심 사용자 | 개발자 | PM / PO / Designer / Developer |
| Mental Model | Worker / Session / Project | Team / People / Work |
| 주요 UI | Kanban / Terminal / Git | Human Desk(Today) / Office / Task |
| 시작점 | Repository / Task | 사용자가 하고 싶은 일 |
| Agent | 실행 Worker | 역할을 가진 AI 팀원 |
| 상태 근거 | session / PR / CI / review 사실 | 같은 원칙(Evidence) + 업무 언어로 번역 |
| 사람의 할 일 | Needs You 열 | Human Desk |
| 계획 | Orchestrator Agent가 이미 제공 | 목표(아직 없음) |

**정직한 평가**: 계획 Orchestrator, 격리 실행, PR/CI 루프는 AO가 이미 앞서 있다. 차별점은 **사용자층**
(비개발자 포함)과 **Mental Model**(Team / Work / Office)뿐이고, 로드맵은 이 차별점이 실제로 체감되는 순서로 짠다.

AO에서 가져올 핵심은 worktree 자체보다 **상태를 사실에서 계산하는 것**과 **사람의 할 일을 한 곳에 모으는 것**이다.

### 3.1 AO에서 따라갈 것 (2026-10-04 레포 조사)

| AO의 방식 | Pixel Office 적용 |
| --- | --- |
| 표시 상태를 저장하지 않고 사실(activity, PR, CI, review)에서 읽을 때 계산한다 | ADR 012 정지 사유와 진행 표시 |
| 자체 Skill 추상화 없이 런타임 네이티브 지침과 Skill을 쓰고, 앱 Skill은 데이터 폴더에 두고 연결한다 | ADR 014 |
| 어댑터가 쓰는 파일은 모두 `.gitignore` 대상이고 사용자 설정을 보존한다 | ADR 013·014: 사용자 프로젝트에 쓰지 않음 |
| `Needs you` 레인. merge는 항상 수동, 막힌 권한 요청에 자동 입력하지 않는다 | Human Desk. 승인은 항상 사람, 권한은 정책 또는 사람 |
| 오른쪽 Inspector(PR, 리뷰, 파일, 미리보기)가 세션에 붙어 있다 | Task 상세의 결과 확인(바뀐 것 / 확인된 것 / 단계 결과) |
| CI 실패, 리뷰 코멘트를 담당 세션에 자동으로 보낸다 | Phase 7. W1에서는 검증 실패 시 해당 단계에서 정지 |
| Dark-first 정밀 도구 UI, 의미 있는 색만, 촘촘한 타이포, sentence case | 시각 방향(§3.2) |

따르지 않을 것: 공유 수단이 없는 구조(Pixel Office는 Team/Skill 패키지로 공유), Terminal·TUI 중심 화면,
worker / session / harness 같은 개발자 용어 노출, 개발자 전용 사용자층.

### 3.2 시각 방향 — "최신 사무실에 끌려온 픽셀 팀"

- **환경은 최신 사무실**: UI, 배경, 오피스 공간은 고해상도의 현대적인 화면이다. 어두운 그래파이트 면, 1px 선,
  유리 회의실, 의미가 있을 때만 쓰는 상태 색, 촘촘한 본문 타이포.
- **픽셀은 캐릭터에만**: 기존 펫 캐릭터와 이름표(픽셀 폰트)만 픽셀이다. 두 해상도의 대비가 콘셉트다.
- **교체 대상**: 따뜻한 종이 톤 배경, 하드 오프셋 그림자, 나무 바닥 오피스, 모든 Panel의 2px 테두리.
- **화면 구조**: 오늘(Human Desk) · 오피스 · 작업 · 팀과 워크플로우 · 스킬 라이브러리.
- **상태**: 2026-10-04 확정 — B안(결재 오피스 구조와 회사 은유) + `graphite` 팔레트. [ADR 015](../ai-docs/adr/015-visual-language-graphite-approval-office.md).
  시안은 claude.ai 아티팩트 "Pixel Office — Modern Office Concept"의 B안 페이지.

---

## 4. 첫 번째 대표 Workflow — W1 "화면 개선 요청"

W1의 정의, 사용자 행동의 의미, 전제 조건, 완료 조건은 [ADR 011](../ai-docs/adr/011-target-user-and-w1.md)이
소유한다. 이 절은 실행에 필요한 흐름과 현재 기능 매핑을 다룬다.

### 4.1 선정 이유

| 후보 | 판단 |
| --- | --- |
| A. 아이디어 → 요구사항 → 화면 검토 → 개발 → 결과 검토 → 승인 | 시작점이 모호하고 요구사항 품질의 근거가 약하다. 범위가 넓다. |
| **B. 기존 화면 → 개선 요청 → Designer 검토 → Developer 구현 → 결과 확인 → 승인** | **선정** |

- 시작점이 구체적이다. 스크린샷과 요청 문장에서 출발한다.
- 이미 있는 자산과 맞는다. 순차 Workflow, 첨부, 승인/수정 요청이 있고, `ai-docs/pixel-office-product-team`에
  UX → UI → Developer 팀과 Handoff 계약이 있다.
- Evidence가 명확하다. 단계 산출물, 변경 파일, 검증 명령이 모두 관찰 가능한 사실이다.

### 4.2 W1 흐름

```text
사용자(PM/Designer)
  │  기존 화면 스크린샷 + "이렇게 바꾸고 싶어요"
  ▼
① 요청 ─ 연결된 프로젝트 + Product Team
  │      W1 시작 직전 프로젝트 기준점 기록 (ADR 013)
  ▼
② UX Designer ─ UX Output Contract
  ▼   ┐
③ UI Designer ─ UI Output Contract        각 단계가 끝날 때 단계 진행 규칙(ADR 012 §4)
  ▼   │                                    · 정상 → 다음 단계 자동 시작
④ Developer ─ 파일 변경 + 검증 명령       · 사용자 질문 / 결과 불완전 / 확인 실패 → 정지, Human Desk
  ▼   ┘                                    · 사용자가 요청한 확인 지점 → Human Desk
  │      실행 도중 권한 요청 → 업무 언어로 Human Desk (§7)
  ▼
⑤ 결과 확인 ─ 바뀐 것 / 확인된 것 / 단계별 결과
  ▼
⑥ 승인(변경 유지)  ·  수정 요청(고른 단계부터 다시)  ·  되돌리기(작업 전 상태로)
```

- **사용자 질문과 다음 역할의 질문을 나눈다.** UX가 UI에게 넘기는 미결정 사항(`open_questions`)은 사람을
  부르지 않는다. 사용자만 답할 수 있는 질문(`user_questions`)만 Human Desk로 간다.
- **화면 용어**: 승인, 수정 요청, 되돌리기, 작업 전 상태, 바뀐 파일. commit, PR, Git은 Simple Mode에 나오지 않는다.
- **시작할 수 없는 경우**: 프로젝트에서 작업 전 상태를 기록할 수 없거나(Git 저장소가 아님), 같은 프로젝트에서
  파일을 수정하는 다른 작업이 진행 중이면 시작 전에 구현 용어 없이 이유를 알린다(ADR 013 §2).

### 4.3 현재 기능 매핑

| W1 단계 | 필요한 것 | 현재 상태 | 부족한 것 | Phase |
| --- | --- | --- | --- | --- |
| 준비 | AI 런타임 연결 | **부분** — 설치·인증 상태 확인. 로그인은 온보딩이 `claude auth login` / `codex login`을 **터미널에서 실행하라고 안내** | 앱 안에서 시작하는 로그인 | 3 |
| 준비 | 프로젝트 연결 | **현재** — 폴더 선택기, Project scope(ADR 005) | — | — |
| 준비 | 기준점 조건 확인 | **목표** | 작업 전 상태를 기록할 수 있는 폴더인지, 같은 프로젝트에 열린 기준점이 있는지 확인 | 1 |
| 준비 | Product Team 한 번에 준비 | **목표** — Agent/Skill/Workflow preset을 각각 직접 만들어야 함 | "Product Team 사용하기"(§4.5) | 1 |
| ① 요청 | 스크린샷 + 요청문 + Workflow | **현재** — 공통 Composer, 첨부(클립보드 이미지 포함), Task Workflow 지정 | — | — |
| ① 기준점 | W1 시작 시 프로젝트 상태 기록 | **보류** — 되돌리기 보류로 함께 보류 | ADR 013 "후속 방향" | — |
| ②③④ 단계 계약 | 단계별 Output Contract, 파일 수정 허용 | **부분** — 순차 실행, preset은 Agent 순서만 저장, 이전 단계 요약문만 전달 | 단계 계약 저장, Output Contract 수집·검증(ADR 012 §3) | 1 |
| ②③④ 단계 진행 | 근거에 따른 자동 진행 / 정지 | **목표** — 단계가 끝나면 무조건 다음 단계 시작 | ADR 012 §4 단계 진행 규칙 | 1 |
| ②③④ 사용자 질문 | 질문에 답하고 같은 단계 계속 | **부분** — `needs_input`과 대화 메시지는 있음 | `user_questions` 정지와 답변 후 같은 단계 재개 | 1 |
| ④ 권한 | 업무 언어 권한 + 정책 | **부분** — 읽기 자동 허용, "터미널 명령 / 파일 변경 / 추가 권한" 라벨, 원시 명령 표시, 세션 동안 허용 | 업무 수준 분류, 자동 승인 정책(§7) | 3 |
| ④ 검증 | 검증 명령과 종료 코드 | **목표** — 도구 이벤트는 있으나 검증으로 분류하지 않음 | ADR 012 §5 | 1 |
| ⑤ 결과 확인 | 바뀐 것 / 확인된 것 / 단계 결과 | **부분** — 요약문, artifact 이벤트, 요약문 속 파일 경로 | 기준점 대비 변경 파일, 검증 결과, 단계별 Output Contract 보기 | 1 |
| ⑥ 승인 | 승인 → 변경 유지 | **현재** — `needs_review → done`, 리뷰 기록 | 기준점 닫기, "검증 없음"이면 승인 전 알림 | 1 |
| ⑥ 수정 요청 | 고른 단계부터 다시 | **부분** — 마지막 담당자(Developer)에게만 같은 세션으로 전달 | 되돌아갈 단계 선택 | 2 |
| ⑥ 되돌리기 | 작업 전 상태로 복구 | **보류** — 이후 branch/worktree 격리 실행으로 대체 | ADR 013 "후속 방향" | — |
| 전체 | 사람의 할 일 모아보기 | **부분** — 상태별 Today 칸반, 알림, 최근 활동 | 정지 사유별 Human Desk 큐(§6) | 2 |
| 전체 | 중간 확인 지점 | **목표** | 단계 단위 "이 단계 뒤 확인할게요"(ADR 012 §4의 5번) | 2 |
| 전체 | 한도 상태 | **부분** — Run별 토큰 사용량, 세션 한도와 연장, workspace 동시 실행 한도 | 사용자용 한도 상태, 계정 사용량 한도 감지(§10) | 3 |
| 전체 | Office 표현 | **부분** — 쉬는 중 / 진행 중 / 주의 필요 | 여러 Task 위치 규칙, Human Desk 표현(§9) | 2 |

### 4.4 W1 완료 조건

[ADR 011 §4](../ai-docs/adr/011-target-user-and-w1.md)를 따른다. 요약하면 비개발자가 **로그인과 프로젝트 연결을
포함해** W1 전체를 Terminal 없이 끝내고, 결과를 Evidence로 확인하고, 승인 / 단계 지정 수정 요청 / 되돌리기를
할 수 있어야 한다. 로드맵에서는 Phase 3의 완료가 W1 완성이다.

### 4.5 Product Team 사용하기 — 적용 방안 검토

**목표**: "Product Team 사용하기" 한 번으로 UX Designer / UI Designer / Developer와 W1 Workflow가 준비된다
(ADR 011). 범용 팀 템플릿 시스템, Marketplace, Team Builder는 만들지 않는다.

**현재 패키지(`ai-docs/pixel-office-product-team`)**

- 역할 문서 3개, Skill 14개, Handoff 계약과 템플릿 5개, Claude/Codex용 adapter 생성 스크립트, 프로젝트 연결 스크립트.
- `connect-project.mjs`는 Skill 파일을 프로젝트의 `.claude/skills/`, `.agents/skills/`에 설치한다.

**그대로 쓸 수 없는 이유**

1. **이 저장소 개발용 내용이 섞여 있다.** 역할 문서는 "AI Pixel Office의 React, Fastify, SQLite, Electron"을
   전제로 한다. Skill 14개 중 6개(`electron-ipc-safety`, `monorepo-boundaries`, `runtime-protocol-events`,
   `sqlite-run-lifecycle`, `pixel-office-visual-language`, `verification-scope`)는 이 저장소 전용이다.
   나머지 8개(`user-flow-modeling`, `interaction-state-spec`, `product-context-discovery`, `usability-review`,
   `screen-component-spec`, `design-system-discovery`, `handoff-validation`, `conflict-reporting`)는 저장소
   경로나 기술 스택을 언급하지 않아 범용으로 쓸 수 있다.
2. **프로젝트 설치 방식은 사용자 저장소를 바꾼다.** Skill 파일이 W1의 변경 사실과 되돌리기 대상(ADR 013)에
   섞이고, 프로젝트마다 런타임별로 설치해야 하며, 사용자가 만들지 않은 지침이 저장소에 생긴다.

**선택지** (2026-10-04 개정 — [ADR 014](../ai-docs/adr/014-native-skill-and-team-packages.md))

| 방안 | 판단 |
| --- | --- |
| A. 프로젝트에 Skill 파일 설치(`connect-project` 방식) | 위 2번 이유로 W1에 맞지 않음 |
| B. 앱 DB에 Agent / Skill 레코드로 생성, Skill 지침을 prompt에 붙임 | 처음 추천했으나 **철회**. 생태계 형식과 호환되지 않아 Community 공유에 불리 |
| **D. 앱 소유 라이브러리에 표준 `SKILL.md` 폴더와 Team 패키지로 설치, 런타임에 네이티브로 전달** | **채택(ADR 014)** |
| C. Community package format을 기다림 | 아직 없음. W1을 막음 |

**D의 최소 범위**

- **원본**: 패키지의 범용 부분(역할 3개의 책임과 경계, 범용 Skill 8개, Handoff 계약)을 W1용 `bundled` Team
  패키지 하나로 만든다. 이 저장소 전용 Skill 6개는 넣지 않고, 역할 문서의 Pixel Office 전제 문구는 "연결된
  프로젝트" 기준으로 일반화한다.
- **원본이 둘로 갈라지지 않게**: 범용 Skill은 패키지가 계속 원본이다. 이미 있는 `build-adapters.mjs`에 앱 번들용
  출력(라이브러리 형식)을 하나 더 만든다. 역할 문서는 범용 문구와 저장소 전용 문구를 나눈다.
- **생성 결과**: Team과 Skill은 `userData/library/`에 설치하고(Claude local plugin 형식, Codex 추가 Skill 경로),
  workspace에는 Agent 레코드와 Workflow만 만든다. Skill 본문은 DB와 prompt에 넣지 않는다. 사용자 프로젝트에
  파일을 쓰지 않는다.
  - UX Designer, UI Designer: 파일 읽기만, 파일 수정 없음
  - Developer: 파일 수정, 검증 명령 실행
  - W1 Workflow preset: 세 단계와 단계별 Output Contract, 파일 수정 허용 여부(ADR 012)
  - 런타임: 연결된 런타임을 사용한다. 둘 다 연결되어 있으면 기본값을 하나 정하고 나중에 바꿀 수 있게 한다.
- **진입점**: 온보딩의 "첫 AI 동료 만들기"에 추천 선택지로 둔다. 이미 동료가 있는 사용자는 Agent 화면에서 쓴다.
- **다시 누르면**: 같은 팀을 중복 생성하지 않는다. 출처(팀 정의 id와 version)를 레코드에 남기는 작은 schema 추가가
  필요하다. 사용자가 수정한 팀을 새 version으로 갱신하는 기능은 W1 범위 밖이다.

**선행 작업**: 기존 DB Skill을 라이브러리 폴더로 옮기고(ADR 014 §6), Claude·Codex adapter가 라이브러리를
네이티브로 연결하게 바꾼다. Product Team 설치는 그 위에서 동작한다.

**구현 전 확인할 것**

- Codex에서 라이브러리 Skill을 실제로 호출하는 실행, Skill 단위 필터 지원 여부(ADR 014 검증 기록)
- 온보딩 준비 판정(`isRunnableAgent`)은 모든 Agent에 파일 읽기와 **터미널 권한**을 요구한다. 파일을 수정하지
  않는 UX/UI Designer에게 터미널 권한을 줄지, 판정 규칙을 바꿀지 정해야 한다.
- WorkflowPreset은 현재 Agent 순서만 저장한다. 단계 계약 저장 형식은 ADR 후보 6에서 정한다.

---

## 5. 로드맵 — W1 중심

### 5.1 구성 원칙

- **각 Phase는 Harness + 사용자 경험 + Office 표현을 함께 낸다.** 완료 기준은 사용자가 할 수 있게 된 일로 적는다.
- 순서: **Phase 0 기준선 → 1 Evidence → 2 Review/Retry + Human Desk → 3 Permission/한도/로그인(W1 완성)**
  → 4 Worktree/Parallel → 5 DAG → 6 Orchestrator → 7 PR/CI
- Permission/한도를 Worktree 앞에 둔다. 개발 단계에서 권한 요청은 반드시 생기므로 번역하지 않으면 비개발자가
  W1을 끝낼 수 없다(ADR 011 결과).
- W1의 되돌리기는 격리 실행이 아니라 기준점 방식으로 한다(ADR 013). 격리는 병렬이 필요한 Phase 4에서 다룬다.

### Phase 0 — W1 기준선 측정

| 항목 | 내용 |
| --- | --- |
| 할 일 | 지금 기능만으로 W1을 실제로 해 보고 막히는 지점을 기록한다(`pixel-office-usability-team`). 새 기능은 만들지 않는다. |
| 진행 방법 | 현재는 Product Team을 한 번에 만들 수 없으므로 세 동료와 Workflow preset을 직접 만든 뒤 시작한다. 이 준비 시간도 기록한다. 로그인도 현재 방식(터미널 안내)대로 해 보고 기록한다. |
| 산출물 | 단계별 막힘 지점, 권한 요청 수와 종류, 수정 요청 수, 단계 사이에서 추측으로 채워진 질문, 걸린 시간 |
| 완료 기준 | §11 지표의 기준값이 기록되어 있다. 이후 Phase는 이 값과 비교한다. |

### Phase 1 — Evidence와 단계 진행: "무엇을 했고 무엇이 확인됐나"

| 항목 | 내용 |
| --- | --- |
| Harness | Skill 라이브러리 전환과 네이티브 전달(ADR 014) · Product Team 사용하기(§4.5) · 단계 계약 저장과 Output Contract 수집·검증 · 단계 진행 규칙(ADR 012 §4 — 중간 확인 제외) · 검증 사실 분류(ADR 012 §5) · 기준점 기록과 변경 사실 계산(ADR 013 §1~3) · 프로젝트당 열린 기준점 하나 · 승인 시 기준점 닫기 |
| 사용자 경험 (Simple) | "Product Team 사용하기" 한 번으로 시작 · 결과 화면: **바뀐 것**(파일을 업무 단위로 묶어 요약) · **확인된 것**(통과 / 실패 / 검증 없음) · **단계별 결과**(UX/UI 산출물 열람) · 정지하면 Task 상세에 이유와 할 수 있는 행동 표시 · 사용자 질문에 답하면 같은 단계 계속 |
| 사용자 경험 (Developer) | 파일별 diff, 검증 명령 원문과 출력, 기준점 식별자, 단계 Output Contract 원문 |
| Office | 단계가 끝나면 다음 동료에게 산출물을 전달하는 표현, 정지한 동료의 "주의 필요" 표시 |
| 진행 표시 | `UI 명세 완료 · 2/3 단계`, `개발 완료 → 검토 필요`, `확인 실패 → 판단 필요` |
| 완료 기준 | (1) 처음 쓰는 사용자가 "Product Team 사용하기" 이후 추가 설정 없이 W1을 요청한다. (2) 결과를 본 사용자가 변경 내용과 검증 여부를 스스로 말할 수 있다. (3) 모든 W1 결과에 변경 파일 목록이 있고, 검증이 없으면 "검증 없음"이 표시된다. (4) 사용자만 답할 수 있는 질문이 생기면 다음 단계로 넘어가지 않는다. |
| 범위 밖 | 자동 재시도, 되돌리기, 단계 지정 수정 요청, Human Desk 큐(Phase 2), 병렬 |

### Phase 2 — Review/Retry + Human Desk: "지금 내가 할 일"

| 항목 | 내용 |
| --- | --- |
| Harness | 정지 사유별 Human Desk 큐 · 중간 확인 지점(ADR 012 §4의 5번) · 되돌아갈 단계를 고르는 수정 요청(기준점 유지, ADR 013 §4) · 되돌리기(ADR 013 §5) · 실행 밖 변경 감지(ADR 013 §3) |
| 사용자 경험 | Human Desk(§6) · 수정 요청 시 "어느 동료부터 다시 할까요?" · 되돌리기 확인 화면("작업 시작 이후 바뀐 파일 8개를 작업 전 상태로 되돌려요", 되돌릴 수 없는 영역 안내) · Task 생성 시 "이 단계 뒤 확인할게요" 선택 |
| Office | 사람의 판단이 필요한 동료가 Human Desk로 온다(`plan/plan.md` §6의 `needs_review → 사용자 책상으로 이동`). 여러 Task 위치 규칙(§9) |
| 완료 기준 | (1) 사용자가 Task 목록을 뒤지지 않고 Human Desk에서만 W1의 모든 사람 행동을 끝낸다. (2) UX 단계의 문제를 UX 단계로 돌려보낼 수 있다. (3) 되돌리기 후 프로젝트가 W1 시작 전과 같다(ADR 013 §6의 범위 안에서). |
| 범위 밖 | 자동 재시도(기준선 지표에서 필요가 확인되면 추가) |

### Phase 3 — Permission, 한도, 로그인: "비개발자가 끝까지 간다" (W1 완성)

| 항목 | 내용 |
| --- | --- |
| Harness | 원시 권한 요청 → 업무 수준 권한 분류와 자동 승인 정책(§7, ADR 후보 4) · 계정 사용량 한도 감지와 한도 상태 모델(§10) · 앱 안에서 시작하는 런타임 로그인 |
| 사용자 경험 | §7의 권한 요청 화면 · §10의 한도 상태 · 온보딩에서 "연결하기"를 누르면 브라우저 로그인이 열리고 끝나면 앱이 연결 상태를 확인 · Developer Mode에서 원시 명령과 사용량 |
| 완료 기준 | **W1 완성** = ADR 011 §4의 완료 조건을 모두 만족한다. 비개발자가 로그인부터 승인 / 되돌리기까지 Terminal 0회로 끝낸다. W1 한 번에 사람이 답하는 권한 요청 수가 Phase 0 대비 줄어든다(목표값은 Phase 0 측정 후 정함). |
| 확인 필요 | 런타임 로그인과 설치를 앱이 대신 시작할 수 있는지 런타임별로 확인한다. 지원하지 않는 흐름은 UI로 꾸미지 않는다(`agent-guidelines.md`). 안 되는 런타임은 W1 완료 조건에서 그 이유와 함께 명시한다. |

### Phase 4 — Worktree / Parallel: "여러 팀원이 동시에 일한다"

| 항목 | 내용 |
| --- | --- |
| Harness | 격리된 작업 공간, 병렬 Run, 작업 공간 lifecycle, 결과를 원래 폴더에 반영하는 방식 |
| 사용자 경험 | 같은 프로젝트에서 여러 화면 개선을 동시에 맡김 · 내부 구조는 Simple Mode에서 숨김 |
| Office | 여러 책상에서 동시에 일하는 동료 |
| 전제 | ADR 005(실행 경로)와 ADR 013(프로젝트당 기준점 하나)을 개정하는 ADR이 먼저 필요하다 |
| 완료 기준 | 두 개의 W1을 동시에 진행해도 변경이 섞이지 않고, 각 결과를 따로 승인하거나 되돌릴 수 있다. |

### Phase 5 — DAG Workflow

순차 Workflow를 Parallel / Dependency / Condition / Approval / Failure Path로 확장한다. 다음 대표 Workflow W2
(예: Frontend와 Backend를 함께 바꾸는 화면 개선)를 W1 완성 이후 정의하고 W1과 같은 방식으로 매핑한다(ADR 011).

### Phase 6 — Project Orchestrator

목표만 주면 계획, Task 분해, 동료 추천을 만든다. 계획은 사람이 확인한 뒤 실행한다. 배정은 원칙 4를 따른다.

### Phase 7 — Delivery Loop (PR / CI)

Commit → PR → CI → 리뷰 → 피드백 → Agent 수정. 개발자 Workflow로 제공하고, W1의 "승인" 의미(변경 유지)는
바꾸지 않는다.

---

## 6. Human Desk

Today를 상태별 칸반에서 **사람의 판단이 필요한 일의 큐**로 강화한다. 칸반은 보조 보기로 남긴다. 항목은 ADR 012의
정지 사유에서 계산한다.

| 항목 유형 | 계산 근거(사실) | 대표 행동 |
| --- | --- | --- |
| 승인 필요 | 실행 중 권한 요청 대기 | 허용 / 거부 |
| 추가 정보 필요 | 단계 Output Contract의 `user_questions` | 답변 → 같은 단계 계속 |
| 실패하여 판단 필요 | Run 실패, 결과 불완전, 확인 실패, 세션 한도 | 다시 시도 / 수정 요청 / 되돌리기 / 이어서 하기 |
| 검토 필요(중간 확인) | 사용자가 요청한 확인 지점 도달 | 계속 / 수정 요청 |
| 검토 필요 | 마지막 단계가 진행 규칙을 통과 | 결과 보기 → 승인 / 수정 요청 / 되돌리기 |

- 순서는 **작업을 막고 있는 것 먼저**: 승인 필요 → 추가 정보 필요 → 실패 → 중간 확인 → 검토.
- 각 항목은 Task 이름, 담당 동료, 기다린 시간, 대표 행동 하나를 가진다.
- 현재: **부분** — 상태별 Today 칸반, 알림, 최근 활동. 정지 사유별 큐와 우선순위는 없다.

---

## 7. Permission 번역

런타임 권한(Claude SDK `canUseTool`, Codex App Server approval)을 renderer에 직접 보이지 않는 현재 구조
(`runtime-protocol`, approval activity metadata)를 유지하고, 그 위에 **업무 수준 권한 계층**을 둔다.
결정은 ADR 후보 4에서 확정한다.

| 업무 수준 권한 | 원시 요청 예 | 기본 정책(제안) |
| --- | --- | --- |
| 프로젝트 파일 읽기 | Read, Glob, Grep | 자동 허용 (**현재**) |
| 프로젝트 파일 수정·삭제 | Edit/Write, 프로젝트 안 추적 대상 파일 | 파일 수정이 허용된 단계에서 Task 동안 자동 허용. 기준점으로 되돌릴 수 있다(ADR 013). |
| 결과 확인(검증) 실행 | 프로젝트에 정의된 typecheck / test / build / lint | 자동 허용 |
| 새 패키지 설치 | `npm/pnpm/yarn add`, lockfile 변경 | 사용자에게 묻기. 설치된 폴더는 되돌리기로 복구되지 않는다(ADR 013 §6). |
| 되돌리기 범위 밖 변경 | 프로젝트 밖 경로, 무시된 파일 영역 | 사용자에게 묻기 |
| 외부 서비스 접근 | 네트워크, 외부 API | 사용자에게 묻기 |
| 원격 반영·기록 변경 | git commit / push, 기록 재작성 | W1에서는 거부. Developer Mode에서만 묻기 |

```text
Felix가 새 패키지 설치를 요청했어요

왜 필요한가요?
  날짜 선택 컴포넌트를 추가하려고 해요 (react-day-picker)
  이 설치는 '되돌리기'로 완전히 되돌릴 수 없어요.

[이번만 허용]  [거부]          세부 정보 보기 ▸
```

- "세부 정보 보기"와 Developer Mode에서는 원시 명령과 경로를 보여준다.
- 분류할 수 없는 요청은 자동 허용하지 않고 묻는다.
- 현재: **부분** — 읽기 자동 허용, "터미널 명령 / 파일 변경 / 추가 권한" 라벨, 세션 동안 허용.

---

## 8. Simple Mode와 Developer Mode

모드는 사람이 아니라 **보기의 깊이**다. 같은 사용자가 필요할 때 펼친다.

| 정보 | Simple Mode | Developer Mode |
| --- | --- | --- |
| 진행 | `UI 명세 완료 · 2/3 단계` | 단계별 Run, 런타임, 모델, 소요 시간 |
| 결과 | 바뀐 것 / 확인된 것 / 단계 결과 | 파일별 diff, 검증 명령과 출력, 기준점 식별자 |
| 권한 | 업무 언어 요청 | 원시 도구명, 명령, 경로 |
| 한도 | 정상 / 근접 / 불가 | 토큰, Run별 사용량, 세션 한도 값 |
| 실패 | 무슨 일이 있었고 무엇을 할 수 있는지 | 오류 원문, 실행 로그 |
| 되돌리기 | 바뀐 파일 수, 되돌릴 수 없는 영역 안내 | 파일 목록, 참조 이름, patch |

현재: **부분** — ADR 009에 따라 Task 상세의 Workflow / Context / 권한 / 개발자 정보가 접힌 보조 영역에 있다.
처음에는 화면별 "세부 정보" 펼침으로 시작하고, 전역 모드는 필요성이 확인되면 정한다(ADR 후보 3).

---

## 9. Office와 같은 상태를 보는 다른 방법

Office는 표현 계층이다. 상태의 원본은 Task / Run / Evidence이고 같은 상태를 세 곳에서 텍스트로 볼 수 있다.

| 상태 | Office | Human Desk / Today | Task 상세 |
| --- | --- | --- | --- |
| 쉬는 중 | 라운지 / 자기 자리 | 표시 안 함 | — |
| 일하는 중 | 책상에서 작업 | 진행 중 목록 | 현재 단계와 최근 도구 활동 |
| 단계 전달 | 다음 동료에게 산출물 전달 | 진행 중(단계 변경) | 단계별 Output Contract |
| 사람 판단 필요 | Human Desk로 이동, 말풍선 | 정지 사유별 항목 | 이유와 대표 행동 |

**여러 Task를 맡은 동료의 위치**: 사람의 판단이 필요한 Task가 우선이고, 그다음은 가장 최근에 실행된 Task다.
나머지 Task 수는 배지(`+2`)로 표시한다. 현재(`agentOfficeState`)는 완료되지 않은 첫 번째 Task를 고른다.

**접근성(ADR 009)**: 모든 동료는 키보드로 선택할 수 있고 선택하면 위 표의 텍스트 상태를 읽어준다. 상태 텍스트가
먼저 바뀌고 이동 애니메이션은 따라온다. 공간(Review Room, QA Lab 등)은 해당 상태가 실제 사실로 생기는 Phase에서만 추가한다.

---

## 10. 비용과 한도 상태

| Simple Mode 상태 | 의미 | 근거 |
| --- | --- | --- |
| 정상 실행 중 | 제약 없음 | — |
| 이번 작업 시간 한도 근접 | 세션 한도(턴·시간)에 가까움 | 앱 세션 한도 (**현재**) |
| 동시에 맡길 수 있는 일이 가득 참 | workspace 동시 실행 한도 | 동시 실행 한도 (**현재**) |
| 같은 프로젝트의 작업이 끝나야 시작 가능 | 열린 기준점이 있음 | ADR 013 §2 (**목표**) |
| AI 사용량 한도 근접 / 추가 실행 불가 | 계정 사용량 제한 | 런타임 오류·응답에서 감지 (**목표**) |

- 한도로 멈춘 일은 Human Desk의 "실패하여 판단 필요"로 보내고 이어서 하기 / 나중에 하기를 고르게 한다.
- 런타임이 정확한 비용을 주지 않으면 Simple Mode에 비용 추정치를 보여주지 않는다(ADR 012).

---

## 11. 성공 지표

Phase 0에서 기준값을 재고 Phase마다 비교한다. 목표값은 기준값을 본 뒤 정한다.

### 제품 지표 (W1)

| 지표 | 정의 |
| --- | --- |
| W1 완주율 | W1을 시작한 비개발자 중 승인 또는 의도적 되돌리기로 끝낸 비율 |
| Terminal 0회 완주율 | 완주한 W1 중 Terminal이나 개발자 도움 없이 끝난 비율(로그인 포함) |
| 팀 준비 시간 | 첫 실행부터 첫 W1 요청을 보내기까지의 시간 |
| 첫 승인까지 걸린 시간 | 첫 W1 요청부터 승인까지의 시간 |
| 사람 대기 시간 | Human Desk 항목이 생긴 뒤 사용자가 행동하기까지의 시간 |
| 수정 요청 횟수 | W1 하나당 수정 요청 수와 돌아간 단계 |

### Harness 지표

| 지표 | 정의 |
| --- | --- |
| 자동 진행 비율 | 단계 전환 중 사람 개입 없이 다음 단계로 넘어간 비율 |
| 불필요한 정지 | 정지 후 사용자가 아무것도 바꾸지 않고 계속한 비율(정지 규칙이 너무 민감하다는 신호) |
| 놓친 정지 | 승인 후 되돌리거나 다시 고친 W1 중 원인이 앞 단계에 있던 비율(정지 규칙이 너무 둔하다는 신호) |
| Evidence 수집률 | W1 결과 중 변경 파일 목록과 검증 결과(또는 "검증 없음")가 있는 비율 |
| 권한 요청 수 | W1 하나당 사람이 답한 권한 요청 수 |
| 기준점 기록 시간 | W1 시작 시 기준점을 기록하는 데 걸린 시간(ADR 013 재검토 조건) |
| 되돌리기 정확도 | 되돌리기 후 기준점과 차이가 남은 비율 |

### 정성 지표

- 사용성 테스트에서 사용자가 "무엇이 바뀌었고 무엇이 확인됐는지"를 정확히 설명한 비율
- "결과를 믿을 수 있었다"에 대한 응답

---

## 12. ADR 목록과 후보

| # | 주제 | 상태 | 관련 문서 |
| --- | --- | --- | --- |
| 1 | 목표 사용자, 제품 판단 기준, W1 | [ADR 011](../ai-docs/adr/011-target-user-and-w1.md) Accepted | — |
| 2 | Evidence 기반 상태와 단계 진행 규칙 | [ADR 012](../ai-docs/adr/012-evidence-based-state.md) Accepted | ADR 009 |
| 5 | 기준점과 되돌리기 | [ADR 013](../ai-docs/adr/013-baseline-and-rollback.md) 대체됨 → ADR 019. 스냅샷 기법은 재사용 | ADR 005 |
| — | Skill과 Team의 네이티브 패키지 형식 | [ADR 014](../ai-docs/adr/014-native-skill-and-team-packages.md) Accepted · 라이브러리, 네이티브 전달, Product Team 설치, 이전 데이터 초기화 구현 | community-plan-v2 |
| — | 시각 언어 — 그래파이트 결재 오피스 | [ADR 015](../ai-docs/adr/015-visual-language-graphite-approval-office.md) Accepted · 토큰, 공통 primitive, 사이드바, 오피스와 결재함, 조직도, 교육 자료실, 기안서 결재란, 시작 화면 적용 | ADR 009, `design-system.md` |
| — | AO 운영 원칙 도입(모든 직군 대상) | [ADR 016](../ai-docs/adr/016-agent-operating-principles-from-ao.md) Accepted · ADR 012 단계 규칙 4번과 수집 방법 개정 | ADR 011, 012 |
| — | 프로젝트 중심 화면과 기안서 대화 | [ADR 017](../ai-docs/adr/017-project-centered-workspace.md) Accepted · 미구현 | ADR 005, 009, 015 |
| — | 기안서 진행 규칙(메시지 전달, 결재 조건) | [ADR 018](../ai-docs/adr/018-request-run-rules.md) Accepted · 미구현 | ADR 012, 019 |
| — | 작업 공간 격리(git worktree) | [ADR 019](../ai-docs/adr/019-isolated-request-workspaces.md) Accepted · 미구현 | ADR 005, 013 |
| — | 외부 도구 연결(Figma, Notion, Jira MCP를 앱이 한 번 관리) | 후보 — W1 엔진 후 | ADR 003, 014 |
| 4 | 업무 수준 Permission과 자동 승인 정책 | 후보 — Phase 3 전 | ADR 003, ADR 013 §6 |
| 6 | Workflow preset의 단계 계약 저장 형식, Product Team 정의의 출처 기록 | 후보 — Phase 1 전 | ADR 012 §3, `plan.md` §4.8.1 |
| 3 | Simple / Developer 보기 깊이 | 후보 | ADR 009 |
| 8 | Office 표현 규칙(여러 Task 위치, 상태 텍스트 우선, 공간 추가 조건) | 후보 — Phase 2 전 | ADR 009 |
| 9 | 비용과 한도 상태 모델 | 후보 — Phase 3 전 | — |
| 7 | 동료 추천 | 후보 — Phase 6 전 | ADR 007 |

---

## 13. Software Team은 첫 번째 Vertical이다

구조는 AI Team을 기준으로 만들고 첫 Vertical은 Software / Product Team으로 깊게 판다. 다른 Vertical로 넓히기
전에 그 Vertical의 **Evidence가 무엇인지** 먼저 정의한다. 근거를 정의할 수 없는 업무는 ADR 012를 지킬 수 없다.

---

## 14. Positioning

> **Build your AI team. Give them work. Watch them collaborate.**

> **Pixel Office is a desktop workspace where anyone can build and manage an AI team.**

> **Powerful Agent Harness underneath. Simple AI Team experience on top.**

Pixel Office의 경쟁력은 더 많은 Agent를 실행하는 것이 아니라, 사용자가 AI 팀이 한 일을 이해하고, 믿을 수
있는지 판단하고, 지금 자기가 할 일을 알 수 있게 만드는 것이다. 그 첫 증명이 W1이다.

---

## 15. ADR 정합성 검토 기록 (2026-10-04)

ADR 011~013 작성 후 Phase 0~3과 관련 절을 다시 검토해 다음 충돌을 고쳤다.

| # | 충돌 | 근거 ADR | 조치 |
| --- | --- | --- | --- |
| 1 | W1 완료 조건은 Terminal 0회인데, 현재 온보딩은 로그인 명령을 터미널에서 실행하라고 안내하고 어떤 Phase에도 이 문제가 없었다 | 011 §4 | Phase 3에 앱 안 로그인과 런타임별 지원 확인 추가, §4.3 매핑에 추가 |
| 2 | "Product Team 사용하기"가 W1 범위인데 어느 Phase에도 없었다 | 011 §3 | Phase 1에 추가, §4.5 적용 방안 검토 추가. Phase 0은 직접 준비하고 시간을 기록 |
| 3 | 단계 사이 정지 조건이 "미해결 질문" 하나뿐이고 Phase 2에 있었다. 다음 역할에게 넘기는 정상 질문도 사람을 부르게 된다 | 012 §3, §4 | 진행 규칙 전체(중간 확인 제외)를 Phase 1로 이동. `user_questions`와 `open_questions` 구분 |
| 4 | 준비 단계에 "작업 트리가 깨끗한지 확인"이 있었다 | 013 §1 | 커밋되지 않은 상태까지 기준점에 포함하므로 삭제. 대신 기준점 조건 확인으로 교체 |
| 5 | 기준점이 "Git HEAD + 작업 트리 상태", Developer Mode 정보가 "기준 commit"이었다 | 013 §1 | 기준점은 작업 폴더 전체 스냅샷. "기준점 식별자"로 수정 |
| 6 | 승인 설명에 commit / push / PR을 화면에서 안내한다고 적혀 있었다 | 011 §3, 원칙 3 | 화면에서 구현 용어를 쓰지 않도록 수정 |
| 7 | 프로젝트당 열린 기준점 하나라는 제약이 한도 상태와 Phase 4 전제에 없었다 | 013 §2 | §10 한도 상태, Phase 4 전제(ADR 013 개정)에 추가 |
| 8 | 권한 표에서 프로젝트 안 파일 삭제를 "되돌리기 어려운 작업"으로 분류했다 | 013 §5, §6 | 추적 대상 파일은 되돌릴 수 있으므로 수정과 같게 분류. 되돌리기 범위 밖 변경과 패키지 설치는 묻기 |
| 9 | 수정 요청 시 변경을 어떻게 다루는지 정의가 없었다 | 013 §4 | 기준점과 변경을 유지하고 같은 기준점으로 비교한다고 Phase 2에 명시 |
| 10 | 정지 규칙이 너무 민감하거나 둔한지 측정할 지표가 없었다 | 012 재검토 조건 | 자동 진행 비율, 불필요한 정지, 놓친 정지, 기준점 기록 시간, 되돌리기 정확도 지표 추가 |

**남은 확인 사항**(충돌은 아니지만 구현 전에 정해야 함)

- 런타임 로그인과 설치를 앱이 대신 시작할 수 있는지(Phase 3)
- UX/UI Designer에게 터미널 권한이 필요한지, 온보딩 준비 판정을 바꿀지(§4.5)
- Workflow preset의 단계 계약 저장 형식과 Product Team 출처 기록(ADR 후보 6, Phase 1 전)
- Output Contract 수집 방법의 런타임별 지원 여부(ADR 012 §3)
- 되돌리기 후 Task가 돌아갈 상태와 `task-state` 전이 표(ADR 013 §5)
