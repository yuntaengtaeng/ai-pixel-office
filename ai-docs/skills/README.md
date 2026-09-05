# 프로젝트 개발 스킬

이 디렉터리는 Codex와 Claude Code가 함께 사용하는 프로젝트 스킬의 단일 원본이다. 각 런타임은
`AGENTS.md`와 `CLAUDE.md`의 공통 읽기 순서를 통해 작업에 적용되는 스킬을 선택한다.

## 사용 가능한 스킬

- [`frontend-code-style`](./frontend-code-style/SKILL.md): TypeScript, JavaScript, React 코드 작성 및 리뷰
- [`backend-server-code-style`](./backend-server-code-style/SKILL.md): apps/server(Fastify) 코드 작성 및 리뷰
- [`pixel-office-comment-guidelines`](./pixel-office-comment-guidelines/SKILL.md): 주석, JSDoc, UI 노출 문자열 작성 및 리뷰

작업에 해당하는 스킬만 읽는다. 요청 범위 밖의 기존 코드를 스킬 규칙에 맞추기 위해 일괄 수정하지 않는다.
