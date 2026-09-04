# Design System 전환 작업 계획

## 목적

`apps/web`이 스타일 구현 세부사항에 직접 의존하지 않고 `@ai-pixel-office/design-system` 하나를 통해
공통 token과 UI primitive를 사용하도록 정리한다.

현재 `packages/design-token`은 순수 값 패키지로 유지하되 web의 직접 의존에서는 숨긴다. 기존
`packages/ui`는 `packages/design-system`으로 변경하고 token, component, browser primitive의 공개
진입점 역할을 맡는다.

최종 의존 방향은 다음과 같다.

```text
apps/web
  -> @ai-pixel-office/design-system
  -> @ai-pixel-office/domain
  -> @ai-pixel-office/pet

@ai-pixel-office/design-system
  -> @ai-pixel-office/design-token

@ai-pixel-office/design-token
  -> 외부 UI runtime 의존 없음
```

## 확정한 결정

### 패키지 명칭과 경계

- `packages/ui`를 `packages/design-system`으로 변경
- package name을 `@ai-pixel-office/design-system`으로 변경
- web에서 `@ai-pixel-office/ui` import 제거
- web에서 `@ai-pixel-office/design-token` 직접 import 제거
- design-system이 web에 필요한 token을 다시 export
- `officeTheme`, `colors`, `mediaQuery`처럼 imperative Canvas 코드나 styled-components 밖에서 필요한
  값도 design-system 공개 API를 통해 제공
- `packages/design-token`은 React, styled-components에 의존하지 않는 내부 기반 패키지로 유지
- `Sidebar`, `PageHeader`, `TaskCard`처럼 제품 의미가 있는 컴포넌트는 web의 `shared/ui` 또는 feature에
  유지

### Radix UI 제거

- web의 `radix-ui` 의존 제거
- Radix를 다른 패키지로 이동하거나 감싸서 유지하지 않음
- Dialog는 네이티브 `<dialog>`와 `showModal()`을 기반으로 design-system에 구현
- Popover는 네이티브 Popover API를 기반으로 design-system에 구현
- 브라우저가 제공하는 top layer, Escape 처리, modal interaction 차단을 활용
- 기존 사용자 경험과 접근성 동작을 생략하지 않음

현재 Radix 사용처는 다음 세 파일이다.

- `apps/web/src/shared/ui/FeedbackDialogs.tsx`
- `apps/web/src/features/dashboard/TodayPage.tsx`
- `apps/web/src/features/office/PixelOffice.tsx`

### 공용 스타일 이동

`AppGlobalStyles`를 공용 component 저장소처럼 사용하지 않는다. 범용 요소는 design-system의 각자 파일로
옮기고 제품 문맥이 있는 스타일은 해당 feature 또는 web의 `shared/ui` 가까이에 둔다.

현재 검토 대상은 다음과 같다.

- `.panel`: design-system의 `Panel.tsx` 후보
- `.field`: design-system의 `Field.tsx` 후보
- `.helper-copy`: 기존 `HelperText`로 교체
- `.kicker`: 기존 `Kicker`로 교체
- `.back-button`: design-system의 `BackButton.tsx` 또는 기존 Button variant 후보
- `fieldset`, `legend`: design-system의 `Fieldset.tsx` 후보
- `.prompt-suggestions`: 사용 feature 가까운 component로 이동
- `.technical-details`: 사용 feature 가까운 component 또는 web `shared/ui`로 이동
- `.office-card`, `.office-canvas`, `.office-loading`: office feature로 이동
- `.section-heading`, `.live-badge`, `.count`: 실제 공유 범위를 확인한 뒤 web `shared/ui` 또는 feature로 이동
- `.page-loading`: web `shared/ui`의 독립 component로 이동

`common.tsx`처럼 여러 책임을 한 파일에 다시 모으지 않는다. component마다 파일을 분리한다.

## Token 감사 결과

### 현재 사용 상태

- `colors`: web 전반에서 사용 중
- `typography`: web과 UI primitive에서 사용 중
- `mediaQuery`: 약 66곳에서 사용 중이며 리터럴 `@media (...)`는 제거된 상태
- `zIndex`: 12곳에서 사용 중이며 숫자 z-index 리터럴은 제거된 상태
- `radius`: 9곳에서 사용 중이며 검색 기준 border-radius 리터럴은 제거된 상태
- `space`: `officeTheme`에 주입만 됐고 `theme.space` 사용은 0곳
- `breakpoints`: 숫자 객체를 직접 소비하지 않고 `mediaQuery` 생성에만 사용
- `shadow`: 공통 theme shadow와 역할별 색상 shadow가 사용 중

### 수정할 문제

- `space.ml`, `space.l`은 이름만으로 크기와 역할을 알기 어려움
- `radius.standard`, `comfortable`, `medium`은 순서를 직관적으로 판단하기 어려움
- `packages/design-token/src/typography.ts`의 영문 주석에 깨진 문자열 `??a`가 있음
- breakpoint 값은 최초 제안값이 아니라 기존 UI 경계를 보존한 `425`, `760`, `896`, `1100`, `1280`임
- device 이름 기반 breakpoint가 적절한지 검토 필요
- token을 생성하는 것만으로 끝내지 말고 실제 소비 또는 제거 중 하나를 선택해야 함

### 권장 token 정리

spacing은 모호한 크기 이름보다 값과 관계가 명확한 scale을 사용한다.

```ts
export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
} as const;
```

styled-components theme에서 숫자 key 사용성이 나쁘면 `space.x1`부터 `space.x8`까지 사용한다. `xs`,
`sm`, `ml`, `l`처럼 순서가 불명확한 혼합 명칭은 피한다.

radius도 크기 또는 역할 중 하나의 기준으로 통일한다. 범용 원시 token이라면 크기 scale이 적합하다.

```ts
export const radius = {
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "10px",
  pill: "9999px",
  circle: "50%",
} as const;
```

기존 사용처를 모두 새 이름으로 변경한 뒤 이전 이름은 남기지 않는다.

breakpoint는 기존 화면 동작을 먼저 보존한다. 이번 리팩터링에서 값까지 동시에 변경하면 레이아웃 회귀
원인을 분리하기 어렵다. 우선 현재 값을 유지하고 명칭만 다음 중 하나로 통일한다.

- viewport scale이 목적이면 `sm`, `md`, `lg`, `xl`, `2xl`
- 제품 layout 경계가 목적이면 `compact`, `sidebar`, `wide`처럼 실제 의미 사용

`mobile`, `tablet`, `desktop` 같은 장치 추정 이름은 가능한 경우 피한다. 값 변경은 별도 UI 검증 작업으로
분리한다.

## Dialog 구현 계약

design-system에 다음과 같이 파일을 분리한다.

```text
packages/design-system/src/Dialog.tsx
packages/design-system/src/Dialog.test.tsx
```

필수 동작은 다음과 같다.

- controlled `open` 지원
- `open`이 true가 되면 `showModal()` 호출
- `open`이 false가 되면 `close()` 호출
- 네이티브 `cancel` 이벤트에서 `onOpenChange(false)` 호출
- backdrop 클릭 닫기 정책을 prop으로 명시
- 닫힌 뒤 trigger 또는 열기 전 active element로 focus 복원
- title과 description ID를 생성해 `aria-labelledby`, `aria-describedby` 연결
- `::backdrop`과 content style은 design token 사용
- dialog가 이미 열린 상태에서 `showModal()`을 중복 호출하지 않음
- unmount와 외부 close 상태의 불일치 방지

기존 `FeedbackDialogs`와 `TodayPage`가 필요한 confirm, alert, form 조립은 web에 유지한다. design-system은
제품 문구나 mutation을 알지 않는 범용 Dialog만 제공한다.

## Popover 구현 계약

design-system에 다음과 같이 파일을 분리한다.

```text
packages/design-system/src/Popover.tsx
packages/design-system/src/usePopoverPosition.ts
packages/design-system/src/Popover.test.tsx
```

필수 동작은 다음과 같다.

- controlled `open` 지원
- `popover="auto"` 기반 외부 클릭과 Escape 닫기
- `toggle` 이벤트에서 `onOpenChange` 동기화
- trigger의 `aria-expanded`, `aria-controls` 연결
- 닫힌 뒤 trigger focus 복원
- trigger 기준 위치 계산
- viewport 가장자리 충돌 시 좌우와 상하 위치 보정
- resize와 scroll 시 열린 Popover 위치 갱신
- 위치 계산 helper는 DOM 수치만 다루고 제품 UI를 알지 않음
- PixelOffice의 form과 agent 데이터는 feature에 유지
- Popover panel과 arrow가 필요하면 token 기반 style만 design-system에서 제공

Electron과 지원 브라우저의 Popover API 지원 범위를 확인한다. 지원 runtime 계약에 포함되지 않는 브라우저가
있다면 작은 capability fallback을 추가하되 Radix 수준의 범용 positioning engine을 만들지는 않는다.

## 작업 순서

1. 현재 staged diff와 working tree 확인
2. `packages/ui`를 `packages/design-system`으로 이동
3. package name, workspace dependency, lockfile 갱신
4. design-system에서 design-token 공개 API 재노출
5. web의 `@ai-pixel-office/ui` import를 design-system으로 변경
6. web의 `@ai-pixel-office/design-token` import를 design-system으로 변경
7. web `package.json`에서 design-token 직접 의존 제거
8. token 명칭과 typography 주석 오타 수정
9. 실제 padding, margin, gap에 `space` token 적용
10. AppGlobalStyles의 범용 클래스를 독립 component로 이전
11. 제품 전용 전역 스타일을 feature 또는 web `shared/ui`로 이전
12. 네이티브 Dialog 구현 및 기존 두 Dialog 사용처 전환
13. 네이티브 Popover 구현 및 PixelOffice 전환
14. web `package.json`에서 `radix-ui` 제거
15. AppGlobalStyles에 reset 외 범용 component 스타일이 남지 않았는지 확인
16. canonical architecture 문서 갱신
17. 의존 설치와 전체 검증
18. 변경 파일 재스테이징

## 리팩터링 주의사항

- token 적용을 이유로 feature styled-component를 전부 design-system으로 옮기지 않음
- 한 번만 쓰는 제품 UI를 재사용 가능성만 예상해 공용화하지 않음
- spacing token 적용 시 CSS 속성 의미가 잘못 바뀌지 않도록 기계적 문자열 치환 금지
- box-shadow offset은 4px spacing grid 검사 대상에서 제외
- pet 픽셀 팔레트와 PixelOffice 도트 색상은 UI theme color가 아니라 콘텐츠 데이터로 취급
- Canvas imperative API에서 필요한 색상은 design-system이 재노출한 `colors` 사용
- breakpoint 값 변경과 package 구조 변경을 한꺼번에 하지 않음
- Dialog와 Popover 전환 전후 keyboard 동작을 비교
- 기존 사용자 변경과 staged 상태를 보존
- 사용자가 요청하지 않으면 commit하지 않음

## 완료 조건

- web `package.json`이 `@ai-pixel-office/design-system`에 의존
- web `package.json`에 `@ai-pixel-office/ui`, `@ai-pixel-office/design-token`, `radix-ui`가 없음
- web source에 위 세 package의 import가 없음
- design-system만 design-token에 직접 의존
- `theme.space` 또는 design-system spacing helper가 실제 레이아웃에서 사용됨
- radius, z-index, breakpoint, typography, color가 리터럴 대신 token을 사용
- 숫자 z-index 리터럴 없음
- border-radius 리터럴 없음
- 리터럴 media query 없음
- AppGlobalStyles가 공용 component 구현 저장소 역할을 하지 않음
- Dialog와 Popover keyboard 및 close 동작 테스트 통과
- typecheck 통과
- lint 통과
- test 통과
- web build 통과
- `git diff --check` 통과

## 검증 명령

```powershell
pnpm.cmd install --offline
pnpm.cmd run check
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build:web
git diff --check
rg -n 'radix-ui|@ai-pixel-office/ui|@ai-pixel-office/design-token' apps/web
rg -n 'z-index:\s*[0-9-]+|border-radius:\s*[^$]|@media\s*\(' apps/web/src packages/design-system/src
```

Electron 프로세스가 `node_modules/.pnpm/electron...`을 점유하면 전체 install이 실패할 수 있다. 이 경우
소스 문제로 오판하지 말고 실행 중인 Electron 프로세스를 확인한다. web과 design-system만 검증할 때는
필요한 workspace 범위를 filter install할 수 있다.
