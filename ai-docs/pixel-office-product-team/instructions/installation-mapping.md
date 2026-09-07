# Installation mapping

Community package installer는 아직 없다. 이 저장소 안에서는 `scripts/connect-project.mjs`가 팀 Skill을
프로젝트 runtime 경로에 연결하며 루트 진입 지침은 사람이 관리하는 `AGENTS.md`와 `CLAUDE.md`에서 팀
진입 문서를 참조한다.

| Source output                               | Future project destination                   |
| ------------------------------------------- | -------------------------------------------- |
| `adapters/codex/generated/AGENTS.md`        | Codex용 프로젝트 진입 지침에 병합 또는 참조  |
| `adapters/codex/generated/.agents/skills/`  | `.agents/skills/`                            |
| `adapters/claude/generated/CLAUDE.md`       | Claude용 프로젝트 진입 지침에 병합 또는 참조 |
| `adapters/claude/generated/.claude/skills/` | `.claude/skills/`                            |

원본의 `skills/<category>/<skill>` 분류는 배포 시 `<runtime-skills>/<skill>`로 평탄화한다. 현재 프로젝트
탐색기가 runtime Skill 루트 바로 아래의 `SKILL.md`만 발견하기 때문이다.

기존 프로젝트 진입 파일을 덮어쓰지 않는다. 공식 package format이 생기면 이 매핑을 installer 입력으로
전환하고 충돌, provenance, version과 rollback 정책을 추가한다.

## Local connection

```bash
node ai-docs/pixel-office-product-team/scripts/connect-project.mjs
node ai-docs/pixel-office-product-team/scripts/connect-project.mjs --check
```

연결기는 `.pixel-office-product-team` marker가 있는 Skill 디렉터리만 갱신한다. 같은 이름의 기존 Skill이
있으면 중단하고 사용자의 파일을 보존한다.
