# Runtime Capability Matrix

검증 기준일: 2026-09-03

| Capability                | Codex 0.151.0                                      | Claude Code 2.1.259                         |
| ------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Non-interactive execution | 검증 완료                                          | `claude -p` live smoke 검증 완료            |
| Structured events         | App Server JSONL로 검증 완료                       | stream-json 실제 출력과 정규화 검증 완료    |
| Tool events               | terminal start/completed 검증 완료                 | Read tool_use/tool_result live 검증 완료    |
| Approval round trip       | request → accept → 동일 turn 완료 검증             | 미지원, 권한별 allowedTools와 dontAsk 사용  |
| Session resume            | App Server 재시작 후 같은 thread/context 재개 검증 | 같은 session ID의 `--resume` live 검증 완료 |
| Cancellation              | `turn/interrupt` → `interrupted` 검증              | 자식 프로세스 종료 연결 구현                |
| Usage reporting           | input/output/cached token 이벤트 검증              | input/output/cache usage live 검증 완료     |
| Working directory         | 지정한 workspace에서 명령 실행 검증                | 지정한 프로젝트 cwd live 검증 완료          |

첫 런타임은 Codex로 선택했습니다. `codex exec`가 아닌 Codex App Server를 사용한 이유는 제품 임베딩에 필요한 승인 요청/응답과 동일 세션 지속, 구조화 스트리밍, 명시적 turn 취소를 한 프로토콜에서 제공하기 때문입니다.

## Operating mode

- 로컬 단일 사용자, 신뢰된 workspace만 지원합니다.
- `workspace-write` sandbox와 run별 working directory를 사용합니다.
- 승인 정책은 run별로 지정합니다.
- 취소 cleanup 기본값은 비파괴적인 `preserve`입니다.
- 호스팅된 multi-tenant 실행은 범위 밖입니다.

## Known boundary

프로토콜에 기능이 존재하는 것과 현재 로그인/정책/모델 환경에서 end-to-end로 통과하는 것은 구분합니다. 표의 항목은 smoke test가 통과한 후에만 “검증 완료”로 변경합니다.

## Validation evidence

- Capability handshake: 성공
- Basic run: `plan.md` 읽기, tool 이벤트와 `runtime-e2e-ok` 완료 결과 확인
- Approval: 무해한 `node -e` 명령에서 승인 요청을 받고 `accept`를 주입한 뒤 동일 turn 완료
- Resume: 새 App Server 프로세스에서 기존 thread를 열어 이전 codeword 회수
- Cancel: 30초 명령을 3초 뒤 중단하고 `interrupted` 상태 확인
- Automated checks: TypeScript 검사 통과, 단위 테스트 4개 통과
- Claude live smoke: 로그인 확인, 기본 응답, Read 도구 이벤트, usage, cwd, `--resume` 재개 성공

각 실행의 원시 프로토콜 메시지는 `.runtime-logs/*.jsonl`에 보관되며 Git 대상에서 제외됩니다.
