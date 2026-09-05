# Design System

이 문서는 `packages/design-token`, `packages/design-system`, `apps/web`의 styling 소유 경계와
현재 규칙을 다룬다. 특정 버그가 왜 생겼는지 같은 회고는 `lesson.md`가 소유한다.

## 패키지 경계

`apps/web/src/styles/*.css`의 feature 스타일과 `base.css`는 styled-components로 전환을
완료했다. `AppGlobalStyles`가 소유하던 공용 utility className은 모두 component로 옮겼고,
`AppGlobalStyles`에는 이제 `button:disabled` reset만 남는다. `Panel`/`Field`/`Fieldset`/
`Legend`/`BackButton`은 `packages/design-system` 소유다. `PromptSuggestions`/
`TechnicalDetails`/`SectionHeading`/`SectionHeadingCount`/`PageLoading`처럼 여러 feature가
공유하는 조각은 `apps/web/src/shared/ui/`에 둔다. `.office-card`/`.office-loading`/
`.live-badge`(`OfficeCard.tsx`)와 `.office-canvas`(Pixi가 imperative하게 `canvas.className`을
설정하므로 `officeCanvasStyles.ts`의 `createGlobalStyle`로 유지)는
`apps/web/src/features/office/`가 소유한다.

`packages/design-token`이 원시 design token을 소유한다 — semantic `colors`, 4px grid `space`
(`space.x1`~`space.x8`, 실제 레이아웃에 있던 초과값(44/48/56/72px)을 위해 `x11`/`x12`/`x14`/
`x18`을 필요한 값만 추가 — 중간 키를 미리 채우지 않는다), `shadow`, `typography`
(fontFamily/fontSize/fontWeight/lineHeight), `animation`(duration/easing), `breakpoints`와
`mediaQuery`(`sm`/`md`/`lg`/`xl`/`2xl`, 기존 425/760/896/1100/1280px 값은 유지),
`radius`(`xs`/`sm`/`md`/`lg`/`xl`/`pill`/`circle`), `zIndex`를 각각 별 파일로 나누고
`theme.ts`가 `officeTheme` 하나로 합쳐 export한다. React나 styled-components에 의존하지 않는
순수 값 패키지라, 나중에 다른 렌더링 스택이 같은 token을 재사용해도 `design-system`의
React/styled-components 의존을 끌고 오지 않는다.

`packages/design-system`(이전 `packages/ui`)은 `packages/design-token`의 공개 API를
`src/tokens.ts`에서 재노출해 web이 `design-token`을 직접 import하지 않고도 `officeTheme`,
`colors`, `mediaQuery` 등을 쓸 수 있게 한다. web은 `@ai-pixel-office/design-system` 하나에만
의존한다.

## Dialog / Popover

Radix(`radix-ui`)는 web에서 완전히 제거했다. `Dialog`(`packages/design-system/src/Dialog.tsx`)는
네이티브 `<dialog>`와 `showModal()`/`close()`를 기반으로, `Popover`(`Popover.tsx` +
`usePopoverPosition.ts`)는 네이티브 Popover API(`popover="auto"`, `toggle` 이벤트)와 자체
충돌 보정 위치 계산을 기반으로 구현했다. `FeedbackDialogs`, `TodayPage`의 작업 생성 Dialog,
`PixelOffice`의 바로 맡기기 Popover가 이 primitive를 쓴다. Popover의 트리거는 각 caller가
소유하며, `Popover`는 위치 계산과 open/close 상태만 책임진다(화살표 마커는 동적 side 대응
복잡도 대비 가치가 낮아 생략했다).

`Popover`의 panel은 `createPortal`로 `document.body`에 렌더링한다 — `transform`을 쓰는 CSS
`animation`이 걸린 조상 안에 두면 네이티브 Popover API의 top layer 승격이 그 조상의 stacking
context 안에 갇힌다. `Popover`를 어떤 조상 트리에 두든 이 문제가 재발하지 않도록 위치 계산은
그대로 두고 렌더링 위치만 `document.body`로 옮겨 top layer 승격을 보장한다. 배경이 되는 회귀
사례는 [`lesson.md`](./lesson.md)를 참고.

## 색상

색상은 실제 UI 역할에 따라 `brand`, `background`, `text`, `semantic`, `status`, `priority`,
`runtime`, `border`, `shadow`, `action`, `overlay`로 구분한다. styled-component와
`AppGlobalStyles`는 theme token을 직접 참조한다. 반투명 색은 `rgb(... / %)` 대신 8자리
hex(`RRGGBBAA`)로 alpha를 박아 넣는다(기존 `colors.shadow.glow` 컨벤션) —
`colors.overlay.scrim`(Dialog backdrop), `colors.shadow.dialog`/`shadow.snackbar`,
`colors.background.surfaceTranslucent`/`background.actionTranslucent`가 그 예다. 원본 색상이
이미 다른 token과 같은 hex라면(`colors.brand.secondaryTint` = `brand.secondary` + alpha처럼)
값을 복제하지 않고 그 token에서 파생시킨다. 픽셀 캔버스와 pet처럼 콘텐츠 자체를 구성하는
에셋 팔레트는 UI theme 색상과 수명이 다르므로 `packages/pet`에서 독립적으로 소유하고,
`PixelOffice`의 캐릭터 카드·칩처럼 오피스 화면 전용 색(hex와 반투명 `rgb()` 둘 다)도 같은
이유로 theme token 대상에서 제외한다 — 이 파일은 이미 `#4b4541`류 리터럴을 전역적으로 쓰고
있어 UI chrome이 아니라 콘텐츠 데이터로 취급한다.

`packages/pet`은 펫 카탈로그와 픽셀 스프라이트를 단일 공개 API로 제공한다. `createPet()`이
반환하는 `PetActor`는 `move`, `tick`, `stop`, `snapshot`으로 이동 상태를 관리하며 React,
Pixi, Canvas에 의존하지 않는다. web의 Canvas와 Pixi 코드는 이 상태와 픽셀 plot 결과를 각
렌더러 명령으로 변환한다.

## `packages/design-system` 공개 컴포넌트

그 token을 주입받아 소비하는 component만 소유한다.

- `Button`(`$variant` + `$fullWidth`), `IconButton`(`$size` + `$tone`) — 공용 컴포넌트를 만들
  때 크기 축 중 어떤 게 variant로 고정되고 어떤 게 caller가 바꿔야 하는 축인지 구분한다.
  `Button`은 높이는 `min-height`로 고정하고 너비만 `$fullWidth`로 가변(auto ↔ 100%),
  `IconButton`은 정사각형이라 `$size` 하나가 두 축을 함께 결정한다. `apps/web` 전체 43곳의
  리터럴 `className="primary-button"` 등을 전부 `Button`으로 교체 완료 — `base.css`에는
  이제 그 클래스들이 남아 있지 않다.
- `Input`/`TextArea`/`Select`(`Input.tsx`) — 너비, padding, border, focus, disabled와
  textarea resize를 공통 소유한다. `apps/web`의 폼은 raw HTML control 대신 이 primitive를
  사용하고, label과 field 배치는 각 feature 책임으로 둔다.
- `ResetCss`(`ResetCss.tsx`) — 브라우저 기본 스타일 reset(`merchant`의 `@repo/ui-kit`
  `ResetCss`를 반영)을 `createGlobalStyle`로 소유한다. `apps/web/src/main.tsx`가
  `<ThemeProvider>` 안에서 `<ResetCss />`로 렌더링하며, body 기본 색상/배경/폰트는 `var(--x)`
  커스텀 프로퍼티가 아니라 `theme.*`를 직접 참조한다.
- `Text`/`Label`(`typography.ts`) — `Text.*`는 line-height를 유지해 줄바꿈 가능한 본문에
  쓰고, `Label.*`(sans, `Button`이 씀)와 `Label.mono`(모노스페이스, 배지/pill류)는 둘 다
  line-height를 일부러 뺀다. 아이콘+텍스트가 한 줄에 나란히 있는 버튼/입력/배지는 텍스트
  자체의 line box가 아니라 flex 컨테이너의 `align-items: center`로 정렬해야 정확히
  중앙에 맞는다. `HelperText`는 자체 margin을 갖지 않는다 — margin은 이 텍스트를 배치하는
  부모(예: grid `gap`을 가진 컨테이너, 또는 caller가 만든 `styled(HelperText)` wrapper)가
  문맥에 맞게 책임진다. 과거 반대로 설계했던 회귀는 [`lesson.md`](./lesson.md) 참고.
- `fadeIn`/`popIn`/`slideUpIn`(`animation.ts`) — 여러 화면에서 그대로 반복되던
  dialog/snackbar 진입 keyframes를 하나로 모았다. `duration`/`easing`도 `design-token`에서
  재노출한다.
- `icons/`(`TrashIcon`, `CloseIcon`) — 파일마다 따로 박혀 있던 인라인 `<svg>` 아이콘을
  컴포넌트로 뽑았다. 색은 항상 `fill="currentColor"`로 부모 텍스트 색을 따르고, `size` prop만
  받는다.

`apps/web`은 자기 앱 전용 레이아웃 조각을 `packages/design-system`이 아니라
`apps/web/src/shared/ui/`에 둔다(다른 앱이 재사용할 primitive가 아니라 이 앱의 셸/페이지
구조 그 자체이기 때문).

## 남은 일

`Dialog`/`Popover`의 동작 계약(controlled open, focus 복원, 충돌 보정 등)을 지켜주는
component test가 없다 — jsdom/testing-library 도입 방향은
[`ai-docs/adr/004-component-test-library.md`](./adr/004-component-test-library.md)가
제안만 해 뒀고 실제 구현은 하지 않았다.
