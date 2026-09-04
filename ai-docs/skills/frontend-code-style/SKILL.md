---
name: frontend-code-style
description: Apply AI Pixel Office's TypeScript, JavaScript, and React implementation style when writing, modifying, refactoring, or reviewing frontend code.
---

# Frontend Code Style

변경하는 코드에 다음 판단 기준을 적용한다. 패턴 자체보다 상태와 책임을 줄이고, 현재 위치에서 동작 이유를
파악할 수 있게 만드는 것이 우선이다. 기존 코드 전체를 일괄 수정하지 않고 요청 범위의 새 코드와 실제로
건드리는 코드에만 적용한다.

## 판단 우선순위

1. 하나의 사실은 하나의 원본 상태로 표현
2. 비즈니스 의미가 있는 오류와 조건은 이름으로 표현
3. 관련 로직은 함께 읽을 수 있는 가까운 위치에 배치
4. hook, helper, Context는 실제 책임이나 재사용 경계가 있을 때만 도입
5. 추상화가 코드 이동만 늘린다면 명시적인 코드를 선택
6. 저장소의 지원 범위 안에서 ES6 이후 문법을 우선 사용

## 원본 상태만 보관

다른 값에서 바로 계산할 수 있는 값은 state로 중복 보관하지 않는다. 두 state가 같은 사실을 표현하면
동기화 코드와 불일치 가능성만 늘어난다.

```tsx
const [detailId, setDetailId] = useState<string | null>(null);

<DetailDialog open={detailId !== null} detailId={detailId} onClose={() => setDetailId(null)} />;
```

서버 요청 진행 여부나 사용자가 별도로 접은 패널처럼 독립적인 사용자 흐름은 별도 state로 둘 수 있다.
state 제거가 아니라 상태 원본을 하나로 유지하는 것이 목적이다.

## 알려진 서버 오류를 도메인 오류로 변환

UI가 특정 HTTP 상태나 서버 오류 코드에 따라 별도 동작해야 하면 `Response` 같은 transport 구조를
컴포넌트까지 전파하지 않는다. API 또는 service 경계에서 상태와 서버 오류 코드를 함께 확인해 의미 있는
오류로 변환하고 컴포넌트는 그 오류에 필요한 UX만 처리한다.

- 원본 오류나 응답은 가능한 경우 `cause`로 보존
- 알려지지 않은 오류, 네트워크 오류, 5xx는 기존 공통 오류 흐름 유지
- 화면마다 상태 코드 비교를 복제하지 않음
- 서버에서는 `packages/domain/src/errors.ts`의 `DomainError`와 공통 HTTP error handler 계약 우선 사용
- 웹 transport 변경은 `apps/web/src/shared/api/client.ts`의 공통 요청 경계 우선 검토

## 응집도 있는 custom hook 사용

상태와 동작이 하나의 기능 책임으로 설명될 때 custom hook으로 분리한다. 데이터 조회, 갱신, 로딩, 오류가
하나의 흐름이거나 여러 컴포넌트가 같은 상태 기반 동작을 공유할 때 적합하다.

다음 경우에는 분리를 다시 검토한다.

- 반환값이 서로 관련 없는 값과 handler로 계속 늘어남
- 렌더링 구조를 이해하려면 hook 내부를 계속 왕복해야 함
- 순수 계산, HTTP 요청, 화면 조립까지 하나의 hook이 담당함
- 현재 필요하지 않은 재사용을 예상해 매개변수와 분기를 추가함

순수 계산은 utility, HTTP 요청은 API 모듈, 화면 조립은 component에 두고 hook은 상태 기반 흐름에
집중한다.

## 조건과 정책 값에 이름 부여

둘 이상의 의미를 결합하거나 비즈니스 규칙을 표현하는 조건은 소비 위치 가까이에서 `is`, `has`, `can`,
`should` 접두어의 boolean으로 나눈다. 결과도 `result`보다 도메인 의미가 있는 이름을 사용한다. 자명한 단일
비교까지 감싸지는 않는다.

시간, 크기 제한, 상태 코드, 재시도 횟수처럼 정책이나 단위가 있는 값은 이름 있는 상수로 만들고 가능한
경우 이름에 단위를 포함한다.

```ts
const ANIMATION_DELAY_MS = 300;
```

문맥상 자명하고 정책 의미가 없는 인덱스나 boolean 비교 값까지 상수화하지 않는다.

## 코드 시점 이동 최소화

한 곳에서만 사용하는 짧은 정책은 소비 위치 가까이에 둔다. 역할별 UI 구조가 다르면 가까운 `if` 또는
`switch`로 명시하고, 구조가 같고 허용 여부만 다르면 가까운 typed policy 객체를 고려한다. 여러 화면이
공유하는 실제 도메인 정책만 공용 함수나 policy로 분리한다.

함수 추출 전 호출부와 구현부를 오가는 비용이 실제로 줄어드는지 확인한다.

## 중첩 삼항 연산자 제거

삼항 연산자는 단순한 양자 선택에만 사용한다. 조건이 중첩되거나 우선순위 해석이 필요하면 `if`, `switch`,
가까운 계산 블록으로 펼친다. 여러 곳에서 재사용되는 독립 도메인 규칙일 때만 이름 있는 함수로 분리한다.

## 불필요한 Props Drilling 제거

컴포넌트 책임과 입력을 드러내는 props는 유지한다. 중간 컴포넌트가 사용하지 않고 전달만 하는 값이 많으면
다음 순서로 검토한다.

1. 상태와 실제 소비 컴포넌트를 더 가까이 배치
2. `children`과 composition으로 중간 전달 계층 제거
3. 여러 깊은 하위 컴포넌트가 같은 기능 상태를 공유할 때 feature 범위 Context 검토
4. 명확한 공유 수명이 있을 때만 Context 도입

Context provider는 기능 경계 가까이에 두고 명확한 도메인 값만 제공한다. 단순히 props 개수를 줄이기 위해
모든 값과 handler를 Context로 이동하지 않는다.

## 변경 및 리뷰 체크리스트

- 같은 사실을 두 state가 표현하거나 계산 가능한 값을 effect로 동기화하지 않는가
- 특정 서버 오류를 transport 경계에서 도메인 의미로 변환했는가
- custom hook의 책임을 하나의 기능 이름으로 설명할 수 있는가
- 복잡한 조건과 정책 값, 단위에 의미 있는 이름이 있는가
- 현재 동작을 이해하려고 파일과 helper를 불필요하게 왕복해야 하는가
- 중첩 삼항 연산자가 조건 우선순위를 숨기지 않는가
- props가 입력을 표현하는지, 중간 계층을 통과하기만 하는지 구분했는가
- composition으로 충분한 문제에 Context를 추가하지 않았는가
- 결과가 요청을 만족하는 가장 단순한 구현인가
