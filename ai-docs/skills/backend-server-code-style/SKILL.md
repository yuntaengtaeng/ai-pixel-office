---
name: backend-server-code-style
description: Apply AI Pixel Office's Fastify 5, TypeScript backend implementation style when writing, modifying, refactoring, or reviewing apps/server code.
---

# Backend Server Code Style

`apps/server`(Fastify + node:sqlite)에 적용하는 판단 기준이다. Fastify가 공식적으로 강제하지 않는
부분은 이 프로젝트가 선택한 관례로 명시한다. 요청 범위의 새 코드와 실제로 건드리는 코드에만 적용하고,
같은 이유 없이 기존 코드 전체를 일괄 수정하지 않는다.

## 계층 구조 (가벼운 Clean Architecture)

이 프로젝트는 이미 아래 3계층으로 나뉘어 있다. 새 기능도 이 경계를 유지한다.

```text
routes/*.ts (adapter)  --  HTTP 요청/응답 변환, 스키마 검증, 상태 코드만 담당
     |
Orchestrator / 유스케이스 함수 (application)  --  여러 repository 호출을 조합하는 업무 규칙
     |
Repository (infrastructure)  --  SQLite 쿼리, 트랜잭션
     |
packages/domain (entity, 순수 타입·규칙, 프레임워크 의존 없음)
```

- **route 핸들러에 업무 규칙을 넣지 않는다.** 여러 repository 호출을 조합하거나 상태 전이 규칙이
  있으면 `Orchestrator`(또는 새 유스케이스 함수)로 옮긴다. 단순 CRUD 위임(`repository.getX(id)` 하나
  호출하고 응답 포맷만 맞추는 경우)까지 억지로 유스케이스 계층을 만들지 않는다 — 조합이나 규칙이
  실제로 있을 때만 계층을 추가한다.
- `packages/domain`은 Fastify, SQLite, Node 전용 API에 의존하지 않는다. 이 경계는 이미 `architecture.md`가
  정한 원칙이며 이 스킬도 그대로 따른다.
- 계층을 위해 파일을 미리 나누지 않는다. 라우트가 실제로 커지거나(한 리소스에 핸들러 10개 이상)
  다른 라우트가 같은 로직을 다시 구현하려 할 때 유스케이스 함수로 뽑는다.

## 라우트는 도메인별 Fastify 플러그인으로 캡슐화

- 라우트를 리소스 단위(`workspaces`, `projects`, `tasks`, `runs` ...)로 별도 플러그인 함수로 쪼갠다.
  `app.register(workspaceRoutes, { prefix: "/api/workspaces" })` 형태로 조립하고, prefix 안에서는
  경로 리터럴에서 반복되는 접두어를 다시 쓰지 않는다.
- 여러 플러그인이 공유해야 하는 의존성(repository, orchestrator, events)은 조립 루트에서
  `fastify.decorate(...)`로 등록한다. 플러그인 함수 인자로 직접 넘기는 클로저 캡처는 라우트가
  한 파일에 있을 때만 쓰고, 여러 파일로 쪼갤 때는 decorate로 전환한다.
- 공유 데코레이터처럼 캡슐화를 의도적으로 깨야 하는 경우에만 `fastify-plugin`(`fp`)으로 감싼다.
  리소스별 라우트 플러그인은 감싸지 않고 캡슐화된 채로 둔다.
- 새 라우트 파일에서 `FastifyInstance`에 타입 프로바이더 제네릭이 전파되지 않는 문제를 겪으면(빈
  타입 추론), 그 파일에서 `FastifyInstance<..., ZodTypeProvider>` 형태로 다시 명시한다. Fastify의
  타입 프로바이더는 전역으로 전파되지 않는다.

## 요청/응답 검증은 zod 스키마로 표준화

- 새 라우트의 `body`/`params`/`querystring`은 route `schema`에 zod 스키마로 등록하고
  `@fastify/type-provider-zod`의 `withTypeProvider<ZodTypeProvider>()`로 타입을 추론받는다.
  `request.body as { field?: unknown }` 같은 수동 캐스팅과 `if (typeof x !== "string")` 반복 체크를
  새로 추가하지 않는다.
- zod 스키마는 transport 계약(모양, 타입, 필수 여부)만 책임진다. trim, 빈 문자열 정규화, 업무 규칙
  검증처럼 `packages/domain`이 이미 갖고 있는 로직은 zod 스키마로 옮기지 않고 그대로 domain의
  `parseCreateX`/`parseUpdateX` 호출을 유지한다 — 두 계층은 서로 다른 책임(transport 모양 vs 업무
  규칙)이라 계획적으로 남겨둔다.
- 기존 `packages/domain/src/validation.ts`의 손으로 짠 validator는 이번 스킬 적용 범위에서 zod로
  바꾸지 않는다. domain 패키지는 외부 검증 라이브러리 의존 없이 유지하는 것이 현재 선택이다(2026-09
  결정, 관련 배경은 `ai-docs/adr/`에 새 ADR을 추가할 정도로 구조가 바뀌면 그때 갱신).
- 목록 조회의 querystring처럼 domain에 대응 파서가 없는 얕은 검증(필수 workspaceId, enum 상태값 등)만
  zod 스키마로 새로 추가한다.

## 에러 핸들링

- `packages/domain`의 `DomainError`를 던지고 `setErrorHandler`가 최종적으로 상태 코드와
  `{ error: { code, message } }` 형태로 변환하는 현재 계약을 유지한다. 새 에러 케이스도 이 형태를
  따른다.
- 검증 실패, 알 수 없는 5xx 등 이미 분기된 case를 복제하지 않는다. 새 도메인 에러가 필요하면
  `DomainError`의 `code`/`status`만 다르게 던지고 핸들러 분기를 늘리지 않는다.
- 에러 핸들러와 라우트 안에서 `console.error`/`console.warn`으로 직접 로깅하지 않는다. Fastify가
  요청 컨텍스트에 부여하는 `request.log`(또는 최상위 로직이면 `app.log`)를 사용해 요청 ID와 함께
  기록되게 한다.

## 로깅

- 새 서버 인스턴스나 진입점을 만들 때 로거를 끄지 않는다. 프로덕션 실행 경로(`standalone.ts` 등)는
  구조화 로그가 나오도록 유지하고, 개발에서 보기 편하게 하려면 `pino-pretty` transport를 dev 스크립트
  쪽에서만 적용한다(라이브러리 코드에 pretty transport를 하드코딩하지 않는다).
- 요청 처리 중 로깅이 필요하면 `request.log.info/warn/error`를 쓰고, 인증 토큰·비밀번호 등 민감한
  값은 로그에 그대로 넣지 않는다.

## JS/TS 클린 코드

`ai-docs/skills/frontend-code-style/SKILL.md`의 판단 우선순위(하나의 사실은 하나의 원본 상태, 관련
로직은 가까운 위치에, 추상화는 실제 책임이 있을 때만)를 백엔드 코드에도 동일하게 적용한다. 추가로:

- **핸들러는 조합만 한다.** 검증(zod schema) → 유스케이스/repository 호출 → 응답 포맷(`data(reply, ...)`)
  세 단계 이상의 분기 로직이 핸들러 본문에 쌓이면 유스케이스 함수로 뽑는다.
- **같은 검증을 두 번 하지 않는다.** zod가 이미 걸러낸 조건(타입, 필수 여부)을 handler에서 다시
  `if`로 체크하지 않는다.
- **매직 상태 코드에 이름을 준다.** `202`, `204` 같은 상태 코드가 반복 등장하면 리터럴 자체는 그대로
  두되(Fastify 관례상 인라인이 표준), 무엇을 의미하는지 옆의 변수/응답 payload 이름으로 드러낸다.
- **트랜잭션 경계를 흐리지 않는다.** `Repository`의 동기 SQLite transaction 안에서 실패 가능한 준비
  작업(경로 검증, 외부 I/O)을 수행하지 않는다 — `architecture.md`의 run 예약 계약을 그대로 따른다.
- **파일당 책임 하나.** 라우트 플러그인 파일에는 그 리소스의 HTTP 계약만 둔다. SQLite 쿼리나 이벤트
  발행 로직을 라우트 파일에 새로 추가하지 않고 `Repository`/`Orchestrator`/`EventBus`로 보낸다.

## 변경 및 리뷰 체크리스트

- 라우트 핸들러가 여러 repository 호출을 조합하는 업무 규칙을 담고 있는가 — 있다면 유스케이스로
  옮겼는가
- body/params/querystring이 zod 스키마로 선언되어 있고, 같은 검증을 handler에서 다시 하지 않는가
- 새 의존성을 여러 라우트 파일이 공유해야 할 때 클로저 캡처 대신 `decorate`를 썼는가
- 라우트 플러그인이 리소스 단위로 캡슐화되어 있고 prefix로 경로 중복을 없앴는가
- 에러를 `DomainError`로 던지고 로깅은 `request.log`/`app.log`를 썼는가(`console.*` 아님)
- `packages/domain`에 이미 있는 검증 로직을 zod로 중복 구현하지 않았는가
- 결과가 요청을 만족하는 가장 단순한 구현인가
