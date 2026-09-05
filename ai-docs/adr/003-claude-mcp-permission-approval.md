# ADR 003: Claude 실행의 도구 승인을 MCP permission-prompt-tool로 위임한다

## 상태

Proposed — 2026-09-04

## 맥락

`ClaudeRuntimeAdapter`(`apps/server/src/runtime/claude.ts`)는 Claude CLI를 `-p`(print) 헤드리스
모드로 실행한다. 프롬프트를 stdin에 한 번 쓰고 즉시 닫는 구조(`child.stdin.end(input.prompt)`)라,
실행 도중 도구 사용 승인을 사람에게 되물어볼 채널이 없다. 그래서 현재는 `--permission-mode
dontAsk`로 모든 승인을 자동 통과시키고, 대신 `--allowedTools`로 도구 카테고리 단위(Read/Glob/Grep,
쓰기 가능 시 Edit/Write/NotebookEdit, Bash, 옵션별 WebFetch/WebSearch/Figma MCP)만 굵게 제한한다.
`resolveApproval()`도 항상 `false`를 반환하는 스텁이다.

반면 Codex 어댑터(`apps/server/src/runtime/codex.ts`)는 `codex app-server`의 지속 JSON-RPC 연결을 쓰기
때문에 `onApprovalRequest`로 실행 중간에 승인을 요청하고, UI 이벤트(`approval.requested`)와
`orchestrator.resolveApproval()`을 거쳐 사람이 승인/거부하면 그 결과로 실행을 이어갈 수 있다. 두
런타임의 승인 정밀도가 다르다.

Claude CLI(`claude --help` 확인 결과)는 헤드리스 모드에서도 승인 판단을 외부에 위임할 수 있는
옵션을 제공한다.

- `--permission-prompts host`: 승인 응답 주체를 "host(SDK) 또는 `--permission-prompt-tool`"로 지정
- `--permission-mode`: `dontAsk`/`bypassPermissions` 대신 실제로 승인을 요구하는 모드 선택 가능
- `--mcp-config` + `--permission-prompt-tool <tool>`: 로컬 MCP 서버의 tool 하나를 "승인 여부를
  판단하는 콜백"으로 등록

이 경로는 주 stdin/stdout 스트림과 별개인 MCP tool 호출로 승인 왕복이 이뤄지므로, 현재의 1회성
`-p` 실행 구조를 크게 바꾸지 않고도 붙일 수 있다.

## 결정

Claude 어댑터에도 Codex 수준의 실행 중 도구별 승인을 도입한다. 방법은 로컬 승인 중계용 MCP
서버를 이 프로세스 안에서 함께 띄우고, `permission-prompt-tool`로 연결한다.

- 새 MCP 서버(가칭 `approval-mcp`)가 tool 하나(예: `approval_prompt`)를 노출한다. 입력은
  `{ tool, input }`, 출력은 `{ behavior: "allow" | "deny" }`.
- 이 tool 핸들러는 새로 구현하지 않고 Codex 어댑터가 이미 쓰는 승인 대기 구조(`active.approvals`
  맵, `onApprovalPending` 콜백, `orchestrator.resolveApproval()`)를 그대로 재사용한다. Claude
  어댑터의 `resolveApproval()` 스텁을 실제 구현으로 교체한다.
- `spawnClaude` 호출 인자에 `--mcp-config`(이 서버 실행 방법)와
  `--permission-prompt-tool mcp__approval-mcp__approval_prompt`를 추가한다.
- `--permission-mode dontAsk`는 실제로 승인 요청이 발생하는 모드로 교체한다(구체 모드명은
  구현하며 검증 — 아래 재검토 조건 참고).
- 기존 `--allowedTools` 화이트리스트는 1차 방어선으로 유지하고, MCP 기반 승인을 2차 방어선으로
  추가한다(둘 중 하나만으로 대체하지 않는다).

## 결과

- Claude 어댑터도 Codex처럼 도구 호출 단위로 사람이 실시간 승인/거부할 수 있게 된다.
- 승인 UI/이벤트/orchestrator 배선은 Codex 어댑터와 공유되어 중복 구현을 피한다.
- 새로운 운영 요소가 생긴다: 승인 중계 MCP 서버 프로세스의 생명주기 관리, Windows에서
  MCP stdio 연결 동작 검증.
- `--permission-mode`와 `--allowedTools`의 상호작용, `--permission-prompt-tool` 요청/응답
  스키마는 공식 문서화가 충분치 않아 실제 붙여보며 확인해야 하는 위험 요소로 남는다.

## 재검토 조건

구현 중 다음이 확인되면 접근을 재검토한다.

- `--permission-mode`의 실제 동작(어떤 모드가 매 도구 호출마다 승인을 요구하는지)이 문서와
  다르거나 `--allowedTools`와 충돌하는 경우
- Windows에서 MCP stdio 서버 연결이 불안정하거나 지연이 커서 대화형 승인 경험이 나빠지는 경우
- 이 경우 대안으로 `--input-format stream-json`/`--output-format stream-json` 실시간 스트리밍
  입력 방식이나, CLI 대신 Claude Agent SDK의 `canUseTool` 콜백을 직접 쓰는 방식(런타임 어댑터를
  child_process 기반에서 SDK 기반으로 교체)을 비교한다.
