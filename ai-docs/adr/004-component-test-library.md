# ADR 004: React component test는 jsdom 기반 테스트 러너 도입이 필요하다

## 상태

Proposed — 2026-09-04

## 맥락

`packages/design-system`에 native `<dialog>`/`showModal()` 기반 `Dialog`와 Popover API 기반
`Popover`를 새로 구현했다(design-system.md의 Dialog/Popover 구현 계약). 두 컴포넌트 모두 controlled
`open` 동기화, `cancel`/`toggle` 이벤트 처리, backdrop/outside click 정책, focus 복원, viewport 경계
충돌 시 위치 보정처럼 DOM 이벤트와 timing에 의존하는 동작 계약을 가진다. 이런 계약은 코드 리뷰만으로
회귀를 잡기 어렵다.

현재 `test/`는 Node 내장 `node --test`로 domain/API/orchestrator 통합 테스트만 실행하며 루트
`test/*.test.ts`만 스캔한다. jsdom이나 `@testing-library/react` 같은 DOM 렌더링/이벤트 시뮬레이션
의존성이 저장소에 없어 `Dialog.test.tsx`, `Popover.test.tsx`를 계약대로 작성할 방법이 없다. 이번
design-system 전환 작업 범위에서는 인프라를 새로 얹는 대신 이 결정을 별도 ADR로 분리했다.

## 결정 (제안)

`packages/design-system`에 한해 jsdom 기반 component test를 추가한다.

- 테스트 러너는 기존 `node --test`를 유지하되 `node:test` + `node --experimental-*` 대신 jsdom 환경을
  주입하거나, `vitest`처럼 jsdom/happy-dom을 기본 지원하는 러너를 `packages/design-system` scope에
  한정해 devDependency로 추가하는 두 방향 중 하나를 검토한다. 저장소 전체 test runner를 바꾸지 않고
  design-system package 안에서만 실행 범위를 넓힌다.
- DOM 이벤트 시뮬레이션은 `@testing-library/react` + `@testing-library/user-event`를 사용해 실제
  사용자 상호작용(Escape, backdrop click, Tab, resize/scroll)에 가깝게 검증한다.
- `Dialog.test.tsx`, `Popover.test.tsx`는 design-system.md의 Dialog/Popover 구현 계약 항목을 각각
  1:1로 커버하는 테스트 케이스로 작성한다.

## 결과 (예상)

- `packages/design-system`에 새 devDependency(jsdom 또는 vitest, testing-library)가 추가된다.
- 루트 `pnpm test`가 Node 통합 테스트와 design-system component 테스트를 모두 포함하도록 script
  구성을 확장해야 한다.
- CI 실행 시간이 늘어난다. 이번에는 `Dialog`/`Popover` 두 컴포넌트만 대상으로 시작한다.

## 재검토 조건

component 테스트 대상이 `Dialog`/`Popover`를 넘어 design-system 전반으로 늘어나면 이 ADR의 범위를
package 전체 표준으로 넓힐지 재검토한다. Community app처럼 다른 렌더링 스택이 추가되면 그 스택에 맞는
테스트 도구도 별도로 정한다.
