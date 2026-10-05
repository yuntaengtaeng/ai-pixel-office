# 프로젝트 개발 스킬

이 디렉터리는 Codex와 Claude Code가 함께 사용하는 프로젝트 스킬의 단일 원본이다. 각 런타임은
`AGENTS.md`와 `CLAUDE.md`의 공통 읽기 순서를 통해 작업에 적용되는 스킬을 선택한다.

## 항상 적용하는 스킬

- [`readable-testable-code`](./readable-testable-code/SKILL.md): 코드를 작성, 수정, 리팩터링, 리뷰하는 모든
  작업에 가장 먼저 적용한다. 다른 코드 스타일 스킬과 판단이 겹치면 이 스킬의 우선순위(의도 → 책임 → 테스트
  가능성 → 필요한 만큼의 추상화)를 따른다. Codex는 `.agents/skills/`, Claude Code는 `.claude/skills/`의 같은
  이름 진입 스킬로 이 원본을 찾는다.

## 사용 가능한 스킬

- [`frontend-code-style`](./frontend-code-style/SKILL.md): TypeScript, JavaScript, React 코드 작성 및 리뷰
- [`backend-server-code-style`](./backend-server-code-style/SKILL.md): apps/server(Fastify) 코드 작성 및 리뷰
- [`pixel-office-comment-guidelines`](./pixel-office-comment-guidelines/SKILL.md): 주석, JSDoc, UI 노출 문자열 작성 및 리뷰
- [`codex-pixel-pet-assets`](./codex-pixel-pet-assets/SKILL.md): 픽셀 펫 에셋 생성, 스프라이트 시트, 매니페스트, 렌더러 연결

작업에 해당하는 스킬만 읽는다. 요청 범위 밖의 기존 코드를 스킬 규칙에 맞추기 위해 일괄 수정하지 않는다.
