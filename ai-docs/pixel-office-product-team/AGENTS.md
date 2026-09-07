# Codex entry point

이 팀의 공통 원본은 `instructions/`와 `agents/`다. 작업 전에 다음 순서로 읽는다.

1. `instructions/product-context.md`
2. `instructions/role-boundaries.md`
3. 자신의 `agents/<role>.md`
4. `instructions/skill-routing.md`에서 선택한 `skills/*/SKILL.md`
5. Agent 사이 인계가 있으면 `instructions/handoff-contract.md`
6. 기록을 남기면 `instructions/collaboration-records.md`

사용자 요청이 이 팀 지침보다 우선한다. 생성된 `adapters/*/generated` 파일은 직접 수정하지 않는다.
