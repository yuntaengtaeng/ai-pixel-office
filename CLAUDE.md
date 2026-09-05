# Claude Code entry point

AI Pixel Office는 Claude와 Codex 기반의 로컬 우선 AI 팀 작업 공간이다. Claude Code 작업 전
다음 공통 문서를 순서대로 읽는다.

1. [`ai-docs/agent-guidelines.md`](ai-docs/agent-guidelines.md)
2. [`ai-docs/architecture.md`](ai-docs/architecture.md)
3. [`ai-docs/lesson.md`](ai-docs/lesson.md)
4. 비사소한 작업이면 [`ai-docs/workflow-routing.md`](ai-docs/workflow-routing.md)
5. 작업에 적용되는 [`ai-docs/skills/`](ai-docs/skills/) 문서
6. frontend styling 변경이면 [`ai-docs/design-system.md`](ai-docs/design-system.md)
7. frontend feature 폴더 구조 변경이면 [`ai-docs/frontend-structure.md`](ai-docs/frontend-structure.md)
8. 관련 [`ai-docs/adr/`](ai-docs/adr/) 문서

`AGENTS.md`와 이 파일은 도구별 진입점일 뿐이다. 공통 사실은 `ai-docs/`에서만 관리한다.
코드와 문서가 다르면 실제 동작을 확인하고 책임 문서를 갱신한다. 기존 사용자 변경을 보존하고
요청이 없으면 commit하지 않는다.
