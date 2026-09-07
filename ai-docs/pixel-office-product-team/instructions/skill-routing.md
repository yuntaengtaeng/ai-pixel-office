# Skill routing

요청을 직접 해결하는 Primary Skill을 먼저 선택하고 별도 판단이 필요할 때만 Supporting Skill을 추가한다.

| 작업                    | Primary                              | Supporting                  |
| ----------------------- | ------------------------------------ | --------------------------- |
| 기능의 문제와 범위 정리 | `user-flow-modeling`                 | `product-context-discovery` |
| 상태와 예외 정의        | `interaction-state-spec`             | `user-flow-modeling`        |
| 기존 UI 체계 기반 명세  | `design-system-discovery`            | `screen-component-spec`     |
| 구현된 흐름 UX 검수     | `usability-review`                   | `handoff-validation`        |
| 일반 frontend 구현      | 프로젝트 `frontend-code-style`       | `monorepo-boundaries`       |
| server 구현             | 프로젝트 `backend-server-code-style` | `sqlite-run-lifecycle`      |
| Electron 변경           | `electron-ipc-safety`                | `monorepo-boundaries`       |
| runtime adapter 변경    | `runtime-protocol-events`            | `verification-scope`        |
| Agent 사이 인계         | `handoff-validation`                 | `conflict-reporting`        |
