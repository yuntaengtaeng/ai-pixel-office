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

`shared/ui` 컴포넌트는 표시 값과 callback만 받는다. Task 상태, API 호출, 라우팅 규칙 같은 비즈니스
로직을 넣지 않고, 그런 값은 feature의 `utils/`와 `hooks/`에서 계산해 넘긴다. 예를 들어 `Pill`은 색과 내용만 받고,
기안서 상태를 라벨과 색으로 바꾸는 일은 `features/tasks/components/TaskStatusPill.tsx`가 한다. 여러 feature가 쓰는 입력창
조각은 `shared/ui/composer/`, 첨부 상태는 `shared/hooks/useAttachmentDraft.ts`에 둔다. 바뀐 내용 보기는 `shared/ui/DiffView.tsx`(unified diff 표시)와 `shared/lib/diffLines.ts`(줄 종류 나누기)를 쓴다.

화면 조각은 Composition 패턴으로 만든다. 변형이 생길 때 boolean이나 옵션 prop을 늘리지 않고, 작은 하위 조각과
children을 조합하게 한다. 예를 들어 `shared/ui/SelectableList.tsx`는 `SelectableList`, `SelectableList.Group`,
`SelectableList.Item`을 조합하고 항목 안의 제목과 보조 설명은 children으로 받는다. 하위 조각은 함수 속성으로 붙여
React Fast Refresh 규칙(컴포넌트만 export)을 지킨다.

공용 UI 구현은 `common.tsx` 같은 단일 파일에 모으지 않고 `PageHeader.tsx`, `Empty.tsx`,
`ErrorBanner.tsx`, `FullScreenMessage.tsx`처럼 컴포넌트별 파일로 둔다. `padding`, `gap`,
`margin`은 4px grid를 사용하고 그림자 offset은 이 규칙에서 제외한다. overlay 계층은 숫자를
직접 쓰지 않고 `theme.zIndex`의 역할별 토큰을 사용한다.

## 대표 사례

- `AppSidebar.tsx` — 사이드바 전체(브랜드, 새 요청, 메뉴 그룹, 프로젝트 트리, 결재함 수, 런타임 출근 상태, 설정)를
  그리는 독립 컴포넌트. 프로젝트 트리는 `SidebarTreeItem` 표시 값으로만 받고, 어떤 프로젝트를 펼치고 어떤 기안서를
  보일지는 `features/projects/utils/sidebarProjects.ts`와 `hooks/useSidebarProjects.ts`가 계산한다.
- `features/tasks/` — 기안서. `TaskDetailPage`와 `NewRequestPage`는 조립만 하고, 화면 영역은
  `components/detail/`(머리글, 대화, 입력창, 준비, 실행 환경, 취소), `components/review/`(결재와 맞춰 달라고 하기),
  `components/board/`(보드, 인스펙터), `components/compose/`(새 요청 입력창)로 나눈다. 각 action 컴포넌트가 자기
  mutation을 갖고, 보드 칸, 순서 대기 표시, 담당 후보 같은 규칙은 `utils/`의 순수 함수로 테스트한다.
- `features/records/` — `RecordsPage`는 조립만 하고, 프로젝트별 묶음과 검색은 `utils/recordGroups.ts`(프로젝트 화면의
  기록 탭도 같은 함수를 씀), 목록은 `components/RecordList.tsx`, 읽기·편집과 저장·삭제는 `components/RecordEditor.tsx`가
  맡는다.
- `features/lead/` — 프로젝트 팀장 탭. `LeadWorkspace`가 대화(`LeadMessageList`), 입력창(`LeadComposer`), 맡긴 기안과
  보고(`LeadDelegatedPanel`)를 조립한다. 계획서 카드는 조합형 `PlanCard`(`.Main`, `.Header`, `.Order`, `.Deliverables`,
  `.Aside`)이고 결재·반려 mutation은 `PlanDecision`이 갖는다. 슬라임 모양과 카드 내용 계산은 `utils/leadView.ts`, 픽셀
  모양 데이터는 `sprites/slime.ts`에 둔다.
- `features/projects/` — `ProjectsPage`는 프로젝트 목록, `ProjectWorkspacePage`는 한 프로젝트의 팀장, 기안서 보드,
  기록, 설정 탭을 조립한다. 설정 폼과 삭제는 `components/settings/`에 둔다.
- `features/desk/` — 결재함. `utils/deskItems.ts`가 Task 상태와 승인 기록에서 서류 종류와 순서를 계산하는
  순수 로직, `hooks/useDeskItems.ts`가 조회, `components/`가 서류 카드와 패널이다. 첫 화면(`OfficeHomePage`),
  결재함 페이지, 사이드바 결재함 수가 같은 hook을 쓴다.
- `RecordsPage.tsx`의 `기록실`은 사용자가 작성하거나 Task 결과에서 만든 Markdown을 앱 전용
  `general/records/<workspaceId>`에 파일 원본으로 저장한다. HTTP 계층은 목록·작성·수정·삭제·
  가져오기만 제공하고 web은 Node/filesystem API를 직접 사용하지 않는다. 문서 frontmatter의
  `taskId`/`runId`가 명시적 연결을 보존하며 세션 임베딩 검색은 ADR 006의 별도 인덱스 계층으로
  결합한다. Task의 `AI로 문서 만들기`는 마지막 완료 run의 담당 Agent와 모델로 read-only
  문서화 실행을 별도로 수행해 원래 Task/run 상태를 바꾸지 않는다. `referenceTaskIds`로
  명시적으로 연결한 문서와 Task 자체에서 생성한 문서는 새 실행 프롬프트의 참고 자료로 제한
  길이 안에서 전달한다.
- `BaseLayout.tsx` — padding/max-width 프레임 하나만 가진 얇은 wrapper. **App 셸이 아니라
  각 페이지가 자기 콘텐츠를 감쌀 때 쓴다** — 페이지(OfficeHomePage/InboxPage/ProjectsPage/
  ProjectWorkspacePage/NewRequestPage/OrgChartPage/AgentDetailPage/SkillsPage/SettingsPage/TaskDetailPage 등)가
  각자 `<BaseLayout>`으로 감싼다. 이렇게 페이지 쪽에 둔 이유: App 셸 레벨에서 감싸버리면
  나중에 풀스크린이나 자체 sticky 영역이 필요한 화면이 이 padding을 벗어날 방법이 없어진다.
  `FullScreenMessage`(로딩/에러 풀스크린 상태)는 의도적으로 `BaseLayout` 밖에 둔다.
- `App.tsx`의 `AppShell`은 `AppSidebar` + `Content` 두 열만 배치하는 얇은 `Shell`
  컨테이너다 — padding 로직은 전혀 없다.
