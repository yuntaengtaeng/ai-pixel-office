# Frontend Feature Structure

`apps/web/src/features/<feature>` 폴더 구성 규칙을 다룬다. 코드 스타일(상태, hook, 조건문
작성 기준)은 [`skills/frontend-code-style`](./skills/frontend-code-style/SKILL.md)이 소유한다.

`apps/web/src/features/<feature>`는 React 개발자가 파일 위치를 예측할 수 있도록 파일 유형을
1차 분류로 사용한다. 필요한 디렉터리만 만들며 빈 표준 디렉터리를 미리 생성하지 않는다.

파일 크기나 줄 수 자체는 분리 근거가 아니다. **테스트 격리 가능성을 컴포넌트와 로직의 책임
경계를 검증하는 도구로 사용한다.** 독립된 행동이나 정책이 있는 코드는 다른 기능을 함께
실행하지 않고 그 행동만 검증할 수 있는 단위로 분리한다.

```text
features/<feature>/
  FeaturePage.tsx
  api.ts
  components/
    Component.tsx
    <responsibility>/
      Component.tsx
  hooks/
    useFeatureFlow.ts
  utils/
    featurePolicy.ts
  types/
    feature.ts
```

- React로 렌더링되는 요소는 `components/`, 상태와 생명주기를 소유한 기능 흐름은 `hooks/`,
  React에 의존하지 않는 순수 로직은 `utils/`에 둔다.
- `components/`에서 동일한 화면 책임을 가진 파일이 3개 이상이거나 독립 탐색 단위가 되면
  `components/results/`처럼 의미 있는 하위 그룹을 만든다. `common`, `misc`, `parts`처럼
  책임이 드러나지 않는 이름은 사용하지 않는다.
- 한 컴포넌트에서만 쓰는 style, helper, type은 해당 컴포넌트와 함께 둔다. 두 번째 소비자가
  생기거나 독립 계약이 확인될 때 상위 `hooks/`, `utils/`, `types/` 또는 `shared/`로 승격한다.
  여러 파일이 사용하는 feature 전용 타입은 `types/`에 책임별 파일로 묶고, 단일 컴포넌트의
  props 타입은 해당 컴포넌트에 유지한다.
- Page는 route parameter와 주요 화면 영역을 조립한다. 서버 조회·mutation이 하나의 기능
  흐름으로 설명될 때만 custom hook으로 옮기며 페이지의 모든 값을 반환하는 만능 hook은
  만들지 않는다.
- feature 외부에는 공개 진입점만 노출한다. 내부 폴더마다 탐색용 `index.ts`를 반복해서
  만들지 않는다.
- 컴포넌트 전용 styled-component는 컴포넌트 파일에 둔다. 여러 화면에서 실제로 공유되는
  primitive만 design system이나 `shared/ui`로 이동한다.
- 독립된 이름과 UI 책임을 가진 React 컴포넌트는 크기와 관계없이 컴포넌트별 파일로
  분리한다. 이름 없는 단순 마크업까지 예상 재사용을 위해 컴포넌트화하지는 않는다. 별도
  파일로 옮겼더라도 부모 Page의 상태, API, mutation 또는 style에 불필요하게 결합되어
  단독 검증할 수 없다면 책임 분리가 끝난 것으로 보지 않는다.

공용 UI 구현은 `common.tsx` 같은 단일 파일에 모으지 않고 `PageHeader.tsx`, `Empty.tsx`,
`ErrorBanner.tsx`, `FullScreenMessage.tsx`처럼 컴포넌트별 파일로 둔다. `padding`, `gap`,
`margin`은 4px grid를 사용하고 그림자 offset은 이 규칙에서 제외한다. overlay 계층은 숫자를
직접 쓰지 않고 `theme.zIndex`의 역할별 토큰을 사용한다.

## 대표 사례

- `Sidebar.tsx` — 사이드바 전체(브랜드, 런타임 상태, workspace chip, nav, note)를 소유하는
  독립 컴포넌트. `App.tsx`는 `workspace`/`runtimeStatus`만 넘긴다.
- `RecordsPage.tsx`의 `기록실`은 사용자가 작성하거나 Task 결과에서 만든 Markdown을 앱 전용
  `general/records/<workspaceId>`에 파일 원본으로 저장한다. HTTP 계층은 목록·작성·수정·삭제·
  가져오기만 제공하고 web은 Node/filesystem API를 직접 사용하지 않는다. 문서 frontmatter의
  `taskId`/`runId`가 명시적 연결을 보존하며 세션 임베딩 검색은 ADR 006의 별도 인덱스 계층으로
  결합한다. Task의 `AI로 문서 만들기`는 마지막 완료 run의 담당 Agent와 모델로 read-only
  문서화 실행을 별도로 수행해 원래 Task/run 상태를 바꾸지 않는다. `referenceTaskIds`로
  명시적으로 연결한 문서와 Task 자체에서 생성한 문서는 새 실행 프롬프트의 참고 자료로 제한
  길이 안에서 전달한다.
- `BaseLayout.tsx` — padding/max-width 프레임 하나만 가진 얇은 wrapper. **App 셸이 아니라
  각 페이지가 자기 콘텐츠를 감쌀 때 쓴다** — 8개 페이지(TodayPage/ProjectsPage/
  ProjectDetailPage/AgentsPage/AgentDetailPage/SkillsPage/SettingsPage/TaskDetailPage)가
  각자 `<BaseLayout>`으로 감싼다. 이렇게 페이지 쪽에 둔 이유: App 셸 레벨에서 감싸버리면
  나중에 풀스크린이나 자체 sticky 영역이 필요한 화면이 이 padding을 벗어날 방법이 없어진다.
  `FullScreenMessage`(로딩/에러 풀스크린 상태)는 의도적으로 `BaseLayout` 밖에 둔다.
- `App.tsx`의 `AppShell`은 `Sidebar` + grid-column 배치만 하는 얇은 `Shell`/`Content`
  컨테이너다 — padding 로직은 전혀 없다.
