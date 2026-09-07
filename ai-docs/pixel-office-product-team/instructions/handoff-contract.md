# Handoff contract v1

Handoff는 Agent 사이의 안정적인 인터페이스다. 이전 Handoff를 덮어쓰지 않고 변경은 Decision Log와 새
revision으로 남긴다. 값이 아직 없으면 필드를 삭제하지 말고 `unknown`과 이유를 기록한다.

## UX -> UI

필수 필드: `type`, `revision`, `status`, `problem`, `user_goal`, `primary_flow`, `states`, `edge_cases`,
`acceptance_criteria`, `open_questions`

UX Handoff에는 visual styling과 임의의 component 구현 결정을 넣지 않는다.

## UI -> Developer

필수 필드: `type`, `revision`, `status`, `source_ux_handoff`, `screen_hierarchy`, `component_hierarchy`,
`component_states`, `interaction_states`, `responsive_behavior`, `accessibility_constraints`,
`design_system_mapping`, `assets`, `open_questions`

UI Handoff에는 근거 없는 product requirement나 backend architecture를 넣지 않는다.

## Developer result

필수 필드: `type`, `status`, `implemented_scope`, `changed_contracts`, `verification`, `deviations`,
`unresolved_questions`
