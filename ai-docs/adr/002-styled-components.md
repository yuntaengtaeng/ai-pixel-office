# ADR 002: UI styling은 styled-components를 사용한다

## 상태

Accepted — 2026-09-04

## 맥락

전역 CSS selector가 여러 기능 화면에 퍼져 있어 같은 `panel`, button, field 모양이 반복되고 화면별
위계가 약하다. 제품 소유자가 styled-components 기반 작업에 익숙하며 Electron과 Community UI에서
공통 theme을 재사용해야 한다.

## 결정

`packages/ui`가 theme과 공통 primitive를 소유한다. 새 UI와 수정하는 화면은 component-scoped
styled-components로 작성한다. 기존 CSS는 시각 회귀를 피하기 위한 한시적 compatibility layer로
주입하고 화면 단위로 제거한다.

## 결과

- design token과 spacing을 TypeScript 경계에서 공유한다.
- 화면별 정보 위계를 selector 충돌 없이 조정할 수 있다.
- 전환 기간에는 global layer와 component style 우선순위를 함께 검증해야 한다.

## 재검토 조건

SSR 성능, 번들 크기 또는 Community app의 렌더링 방식 때문에 runtime CSS-in-JS가 측정 가능한 병목이
되면 zero-runtime 대안을 비교한다.
