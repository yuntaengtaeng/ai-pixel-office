# AI 개발 문서

`ai-docs/`는 Codex와 Claude Code가 함께 사용하는 프로젝트 지침의 단일 원본이다. 제품 사용자를
위한 설명은 `README.md`와 `docs/`, 제품 계획은 `plan/`에서 관리한다.

## 읽는 순서

1. [`agent-guidelines.md`](./agent-guidelines.md)
2. [`architecture.md`](./architecture.md)
3. [`lesson.md`](./lesson.md)
4. 비사소한 작업이면 [`workflow-routing.md`](./workflow-routing.md)
5. 작업에 적용되는 [`skills/`](./skills/) 문서
6. frontend styling 변경이면 [`design-system.md`](./design-system.md)
7. frontend feature 폴더 구조 변경이면 [`frontend-structure.md`](./frontend-structure.md)
8. 작업과 관련된 [`adr/`](./adr/) 문서

## 문서 책임

| 문서                        | 소유하는 내용                                       |
| --------------------------- | ---------------------------------------------------- |
| `agent-guidelines.md`       | 제품 목적, 안정적인 원칙, 공통 작업·검증 규칙       |
| `architecture.md`           | 현재 workspace/runtime 지도, 목표 구조, 의존 방향   |
| `design-system.md`          | design-token/design-system 경계, 색상, Dialog/Popover 규칙 |
| `frontend-structure.md`     | `apps/web/src/features/<feature>` 폴더 구성 규칙    |
| `lesson.md`                 | 실제 실패에서 얻은 판단·검증·운영 교훈              |
| `workflow-routing.md`       | 작업 유형별 권장 에이전트와 위임 기준               |
| `skills/`                   | 작업 유형에 따라 적용하는 코드 및 문구 작성 규칙    |
| `adr/`                      | 중요한 구조 결정의 맥락, 결과, 재검토 조건          |
| `AGENTS.md`, `CLAUDE.md`    | 도구별 최소 진입 절차                               |

공통 사실은 한 문서에서만 소유하고 다른 문서는 링크한다. 현재 경로를 영구 규칙으로 오해하지
않도록 현재 상태와 안정적인 원칙을 구분한다.
