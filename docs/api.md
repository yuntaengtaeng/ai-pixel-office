# API

Base URL: `http://127.0.0.1:47372`

성공 응답은 `{ "data": ... }`, 오류 응답은 `{ "error": { "code", "message" } }` 형식입니다.

## 시스템

| Method             | Path                          | 용도                                          |
| ------------------ | ----------------------------- | --------------------------------------------- |
| GET                | `/health`                     | 서버 상태와 지원 런타임                       |
| GET                | `/api/system/status`          | Codex, Claude, Codex Figma MCP 설치·인증 상태 |
| POST               | `/api/system/check-directory` | `{ "path": "절대 또는 상대 경로" }` 폴더 검증 |
| POST               | `/api/system/pick-directory`  | 운영체제 폴더 선택기 열기                     |
| GET, POST          | `/api/projects?workspaceId=`  | 프로젝트 목록·생성                            |
| GET, PATCH, DELETE | `/api/projects/:id`           | 프로젝트 조회·수정·삭제                       |

## 리소스

| Method             | Path                                         | 용도                        |
| ------------------ | -------------------------------------------- | --------------------------- |
| GET, POST          | `/api/workspaces`                            | 워크스페이스 목록·생성      |
| GET, PATCH, DELETE | `/api/workspaces/:id`                        | 워크스페이스 상세·수정·삭제 |
| GET, POST          | `/api/skills?workspaceId=`                   | 스킬 목록·생성              |
| POST               | `/api/skills/draft`                          | AI 스킬 초안 생성           |
| GET, PATCH, DELETE | `/api/skills/:id`                            | 스킬 상세·수정·삭제         |
| GET, POST          | `/api/agents?workspaceId=`                   | 에이전트 목록·생성          |
| GET, PATCH, DELETE | `/api/agents/:id`                            | 에이전트 상세·수정·삭제     |
| GET, POST          | `/api/agents/:id/task-templates`             | 자주 맡기는 작업 목록·등록  |
| DELETE             | `/api/agents/:id/task-templates/:templateId` | 등록 작업 삭제              |
| GET, POST          | `/api/tasks?workspaceId=&status=`            | 작업 목록·생성              |
| GET, PATCH, DELETE | `/api/tasks/:id`                             | 작업 상세·수정·삭제         |
| GET                | `/api/runs?taskId=`                          | 실행 목록                   |
| GET                | `/api/runs/:id`                              | 실행 상태                   |
| GET                | `/api/activities?workspaceId=`               | 활동 목록                   |

## Inbox

| Method             | Path                               | 용도                                |
| ------------------ | ---------------------------------- | ----------------------------------- |
| GET, POST          | `/api/inputs?workspaceId=&status=` | Inbox 목록·빠른 입력                |
| GET, PATCH, DELETE | `/api/inputs/:id`                  | 입력 조회·수정·보관·삭제            |
| POST               | `/api/inputs/:id/convert`          | 입력을 원본 링크가 있는 Task로 전환 |

입력 종류는 `request`, `feedback`, `idea`, `message`, `file`이며 상태는 `inbox`, `triaged`, `converted`, `archived`입니다. 전환 API에는 Task의 `title`, `description`, `assigneeAgentId`, `priority`, `projectId`를 선택적으로 전달할 수 있습니다.

프로젝트는 `description`, `status`, `figmaUrl`, `path`를 선택적으로 가집니다. 작업의 `projectId`로 프로젝트를 연결하며 프로젝트 삭제 시 작업은 유지되고 연결만 해제됩니다. 워크스페이스, 에이전트, 작업의 `workingDirectory`는 선택 필드입니다. 에이전트의 내부 `mode`는 선택한 스킬 유무에 따라 UI에서 자동 결정됩니다. `GET /api/tasks/:id` 응답에는 `runs`, `reviews`, 최신 실행의 `progress`가 함께 포함됩니다.

## 실행과 검토

| Method | Path                                    | Body                                                                  |
| ------ | --------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/api/tasks/:id/run`                    | `{}`                                                                  |
| POST   | `/api/tasks/:id/retry`                  | `{}`                                                                  |
| POST   | `/api/tasks/:id/approve`                | `{}`                                                                  |
| POST   | `/api/tasks/:id/request-changes`        | `{ "feedback": "..." }`                                               |
| PUT    | `/api/tasks/:id/workflow`               | `{ "agentIds": ["...", "..."] }`                                      |
| GET    | `/api/workflow-presets?workspaceId=:id` |                                                                       |
| POST   | `/api/workflow-presets`                 | `{ "workspaceId": "...", "name": "...", "agentIds": ["...", "..."] }` |
| DELETE | `/api/workflow-presets/:id`             |                                                                       |
| POST   | `/api/runs/:id/cancel`                  | `{}`                                                                  |
| POST   | `/api/runs/:runId/approvals/:requestId` | `{ "decision": "accept" }`                                            |

승인 `decision`은 `accept`, `acceptForSession`, `decline`, `cancel` 중 하나입니다.

순차 Workflow는 실행 이력이 없는 Todo 작업에 2~8명의 에이전트를 순서대로 지정합니다. 각 단계 결과는 다음 단계의 실행 컨텍스트로 자동 전달되며, 마지막 단계가 끝나면 작업이 검토 대기 상태가 됩니다.

Workflow preset은 워크스페이스에 자주 사용하는 2~8명의 협업 순서를 이름과 함께 저장합니다. Task의 순서와는 독립적이므로 preset을 삭제해도 이미 설정된 Task는 변경되지 않습니다.

## 실시간 이벤트

`GET /api/events?workspaceId=<id>`로 SSE에 연결합니다.

- `agent.status_changed`
- `task.status_changed`
- `task.result_updated`
- `activity.created`
- `approval.requested`
- `run.progress`

## 보안 경계

서버는 기본적으로 loopback에만 바인딩되며 인증 계층은 없습니다. 현재는 단일 사용자 로컬 앱을 가정하므로 외부 네트워크나 다중 사용자 환경에 그대로 노출하면 안 됩니다.
