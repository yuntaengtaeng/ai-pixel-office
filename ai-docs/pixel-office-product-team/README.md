# Pixel Office Product Team

AI Pixel Office를 위한 로컬 3인 Agent 팀 템플릿이다. UX Designer가 사용자 흐름을 정의하고, UI
Designer가 구현 가능한 화면 명세로 변환하며, Full-stack Developer가 저장소 계약 안에서 구현한다.

이 폴더는 Community 공식 배포 패키지가 아니다. `team.yaml`은 로컬 팀 메타데이터이며 향후 공식 package
format이 생길 때 migration 입력으로 사용할 수 있다.

## Team flow

```text
UX Designer -> UX Handoff
UI Designer -> UI Handoff
Full-stack Developer -> Implementation Report
각 단계 -> Decision Log와 Open Questions 보존
```

작은 버그나 기술 작업은 필요한 Agent만 실행한다. 세 Agent를 모든 작업에 의무적으로 연결하지 않는다.

## 사용 방법

### 개별 Agent 요청

사용자 흐름과 상태를 먼저 정리하려면 UX Designer 역할을 지정한다.

```text
UX Designer 역할로 Agent 생성 흐름을 검토해줘.
UX Handoff와 미해결 질문을 남겨줘.
```

승인된 UX Handoff를 화면 명세로 바꾸려면 UI Designer 역할을 지정한다.

```text
UI Designer 역할로 이 UX Handoff를 UI 명세로 만들어줘.
기존 design system mapping과 UI Handoff를 남겨줘.
```

승인된 UI Handoff를 구현하려면 Full-stack Developer 역할을 지정한다.

```text
Full-stack Developer 역할로 이 UI Handoff를 구현해줘.
검증 결과와 Implementation Report를 남겨줘.
```

### 전체 팀 Workflow

사용자 흐름부터 구현까지 필요한 큰 기능은 전체 workflow로 요청한다.

```text
pixel-office-product-team workflow로 이 기능을 진행해줘.
UX Handoff, UI Handoff, 구현 결과와 Decision Log를 남겨줘.
```

각 Agent는 downstream 역할을 대신하지 않는다. 명세가 충돌하거나 다음 역할의 결정이 필요하면 임의로
해결하지 않고 `open_questions`, `deviations` 또는 Decision Log 후보로 남긴다. 단순한 버그 수정이나
명확한 기술 작업은 필요한 Agent만 지정한다.

### 협업 기록

팀 작업에서 다음 산출물을 사용한다.

- UX Designer -> `templates/ux-handoff.yaml`
- UI Designer -> `templates/ui-handoff.yaml`
- Full-stack Developer -> `templates/implementation-report.yaml`
- 중요한 결정 -> `templates/decision-log.yaml`
- 구현 후 검수 -> `templates/review-result.yaml`

Task 대화나 실행 결과에 구조화된 내용을 남길 수 있지만, 현재 AI Pixel Office가 이를 전용 Artifact로
자동 분류하거나 별도 회의록 화면에 저장하지는 않는다.

## Source and generated adapters

`agents/`, `instructions/`, `skills/`, `templates/`가 사람이 수정하는 원본이다. 다음 명령은 Codex와 Claude
배포 레이아웃을 `adapters/*/generated` 아래에 다시 생성한다.

```bash
node scripts/build-adapters.mjs
node scripts/validate-package.mjs
node scripts/validate-eval.mjs
node scripts/connect-project.mjs
node scripts/connect-project.mjs --check
```

위 명령은 `ai-docs/pixel-office-product-team`에서 실행하는 형식이다. 프로젝트 루트에서 Skill 연결본을
갱신하거나 확인하려면 다음 명령을 사용한다.

```bash
node ai-docs/pixel-office-product-team/scripts/connect-project.mjs
node ai-docs/pixel-office-product-team/scripts/connect-project.mjs --check
```

`connect-project.mjs`는 이 저장소의 runtime Skill 경로에 팀 Skill을 연결한다. 기존 Skill을 덮어쓰지
않으며 이 팀의 marker가 있는 디렉터리만 이후 동기화한다. 자세한 매핑은
`instructions/installation-mapping.md`를 따른다.

## Existing project skills

개발 Agent는 다음 프로젝트 원본을 복사하지 않고 작업 종류에 따라 참조한다.

- `../skills/frontend-code-style/SKILL.md`
- `../skills/backend-server-code-style/SKILL.md`
- `../skills/pixel-office-comment-guidelines/SKILL.md`
- 픽셀 펫 작업일 때만 `../skills/codex-pixel-pet-assets/SKILL.md`
