# 프로젝트 생성/관리 UX 검토와 구현 — 2026-09-07

pixel-office-product-team workflow(UX Designer → UI Designer → Full-stack Developer → UX Designer)로
진행한 결과 기록이다. 관련 구조 결정은 [`ai-docs/adr/005-explicit-workspace-scope.md`](../adr/005-explicit-workspace-scope.md)에도
반영했다.

제품 결정 범위:

- 연결된 Task가 하나라도 있는 Project는 삭제를 차단한다
- 삭제 확인 다이얼로그에서 이 조건을 미리 안내한다
- 폴더가 연결되지 않은 Project는 Task 재배정 목록에서 제외한다
- ADR-005와 현재 `PROJECT_IN_USE` 서버 계약은 변경하지 않는다

## UX Handoff

```yaml
type: ux-handoff
revision: 1
status: approved
problem: >
  프로젝트 삭제 확인 다이얼로그가 "작업은 삭제되지 않고 프로젝트 연결만 해제됩니다"라고 안내하지만,
  서버는 연결된 Task가 있으면 삭제 자체를 차단한다(PROJECT_IN_USE). 사용자는 안전하다고 안내받은
  행동이 항상 실패하는 것을 보게 된다. 또한 Task 재배정 드롭다운(ProjectSelect)이 폴더 미연결
  프로젝트까지 노출해, 실행이 애초에 불가능한 대상으로 Task를 옮길 수 있었다.
user_goal: >
  프로젝트를 삭제하거나 Task를 다른 프로젝트로 옮길 때, 실제로 가능한 결과만 안내받고
  실행 불가능한 선택지에 빠지지 않는다.
primary_flow:
  - 사용자가 프로젝트 상세에서 '프로젝트 삭제'를 클릭한다.
  - 연결된 Task가 있으면 삭제 불가 안내만 보고 닫는다 (서버 호출 없음).
  - 연결된 Task가 없으면 삭제 여부를 확인하고, 확인 시 프로젝트가 삭제된다.
  - 사용자가 Task 상세에서 프로젝트 재배정 드롭다운을 연다.
  - 폴더가 연결된 프로젝트만 선택지로 보인다.
states:
  - 삭제 가능 (연결 Task 0개)
  - 삭제 불가 (연결 Task 1개 이상) — 안내만 하고 실제 삭제 시도 없음
  - 재배정 목록: 폴더 연결된 프로젝트만 노출
  - 재배정 목록: 현재 배정된 프로젝트가 폴더 미연결인 예외 상태
edge_cases:
  - 연결 Task 0개로 확인 중 다른 곳에서 Task가 추가되는 동시성: 서버 PROJECT_IN_USE가 최종 방어선,
    UI 안내는 낙관적 정보 제공일 뿐이다.
  - 이미 폴더 미연결 프로젝트에 배정된 Task는 재배정 드롭다운에서 현재 선택값이 목록에서
    사라지면 안 된다(값 손실/의도치 않은 변경 방지).
acceptance_criteria:
  - 연결된 Task가 있는 프로젝트에서 삭제를 시도하면, 서버 에러가 아니라 사전 안내로 삭제 불가를 알게 된다.
  - 삭제 확인 문구는 실제 서버 동작과 일치한다 ("연결 해제"라는 표현을 쓰지 않는다).
  - Task 재배정 목록은 폴더가 연결되지 않은 프로젝트를 제외한다.
  - 이미 배정된 프로젝트가 폴더 미연결이어도 재배정 드롭다운은 현재 선택을 유지한다.
  - ADR-005와 PROJECT_IN_USE 서버 계약은 변경하지 않는다.
open_questions:
  - (이전 검토 발견, 이번 범위 밖) 빈 프로젝트 목록 안내 문구("이름만 입력해도 시작할 수 있어요")가
    폴더 연결 필수 정책과 여전히 불일치한다. 이번 제품 결정에 포함되지 않아 수정하지 않았다.
    별도 결정 필요.
  - 삭제 차단 시 '삭제' 버튼 자체를 비활성화할지, 클릭은 허용하고 안내로만 알릴지는 명시되지 않았다.
    "다이얼로그에서 미리 안내"라는 지시를 근거로 버튼은 활성 유지, 클릭 시 안내로 처리함
    (Decision Log 참조, 필요 시 재검토).
```

## Decision Log

```yaml
- type: decision
  date: "2026-09-07"
  topic: "삭제 차단 안내 방식"
  raised_by: "UX Designer"
  decision: >
    삭제 버튼은 항상 활성 상태를 유지하고, 클릭 시 연결된 Task 수로 분기한다.
    Task가 있으면 정보성 AlertDialog로 차단 사유를 안내하고 서버 호출을 하지 않는다.
    Task가 없으면 기존 파괴적 ConfirmDialog로 진행한다.
  reason: >
    사용자 지정 정책은 "삭제 확인 다이얼로그에서 조건을 미리 안내"였고, 버튼 비활성화 여부는
    지정하지 않았다. 버튼을 비활성화하면 사용자가 이유를 알 기회조차 없어지므로, 안내를 통해
    이유를 드러내는 쪽이 지시에 더 부합한다.
  alternatives:
    - "삭제 버튼을 Task 존재 시 비활성화 + title로만 이유 표시 (덜 명시적)"
  impact:
    - "ProjectDetailPage에 AlertDialog 추가"
  requires_adr: false

- type: decision
  date: "2026-09-07"
  topic: "ProjectSelect 필터링 시 현재 값 보존"
  raised_by: "UI Designer"
  decision: >
    ProjectSelect 옵션은 project.path가 있는 프로젝트로 제한하되, 현재 선택된 value와
    일치하는 프로젝트는 폴더 미연결이어도 옵션에 포함한다.
  reason: >
    제품 결정은 "폴더 미연결 Project는 재배정 목록에서 제외"였지만, 이미 그 프로젝트에
    배정된 Task를 열었을 때 현재 값이 옵션 목록에 없으면 controlled <select>가 첫 옵션으로
    떨어지며 사용자가 모르는 사이 배정이 바뀔 위험이 있다. ADR-005의 필터링 원칙을 다른 화면
    (Task 재배정)에 확장 적용하는 결정이라 ADR-005에도 반영했다.
  alternatives:
    - "현재 값도 무조건 제외 (open_question으로 남기고 구현 보류)"
  impact:
    - "apps/web/src/features/projects/ProjectSelect.tsx 필터 로직"
    - "ai-docs/adr/005-explicit-workspace-scope.md 결정 목록에 반영"
  requires_adr: true
```

## UI Handoff

```yaml
type: ui-handoff
revision: 1
status: approved
source_ux_handoff: "위 UX Handoff revision 1"
screen_hierarchy:
  - "ProjectDetailPage > Styled.ContextForm > 프로젝트 삭제 danger 영역"
  - "TaskDetailPage > Styled.TaskMeta > ProjectSelect (todo 상태에서만 노출, 기존과 동일)"
component_hierarchy:
  - "ProjectDetailPage: useConfirmDialog(기존) + useAlertDialog(신규) + <ConfirmDialog>/<AlertDialog> 두 인스턴스 병렬 렌더"
  - "ProjectSelect: 내부 옵션 필터링만 변경, 컴포넌트 트리/props 시그니처는 그대로"
component_states:
  - "삭제 버튼: 기본 활성. remove.isPending일 때만 비활성 (기존과 동일)"
  - "AlertDialog(신규): title '프로젝트를 삭제할 수 없어요', description에 연결 Task 개수 포함,
     tone 기본값(default, 'i' 아이콘) — 파괴적 확인이 아니라 정보 안내이므로 danger 톤을 쓰지 않는다"
  - "ConfirmDialog(기존, 문구만 변경): tone danger 유지, description '삭제하면 되돌릴 수 없습니다.'"
  - "ProjectSelect 옵션: project.path 존재 OR project.id === 현재 value"
interaction_states:
  - "AlertDialog는 확인 버튼 하나만 제공(기존 AlertDialog 컴포넌트 재사용), 닫으면 아무 부작용 없음"
  - "ConfirmDialog 확인 시에만 remove.mutate() 호출 (기존과 동일)"
responsive_behavior: "변경 없음 — 기존 Dialog/Field/Select 반응형 규칙 그대로 재사용"
accessibility_constraints:
  - "AlertDialog는 기존 useDialogIds로 titleId/descriptionId를 자동 연결하므로 추가 aria 작업 불필요"
  - "새 버튼/아이콘 없음 — 기존 포커스 트랩과 키보드 동작 재사용"
design_system_mapping:
  - "AlertDialog, useAlertDialog: apps/web/src/shared/ui/FeedbackDialogs.tsx, shared/hooks/useFeedbackDialog.ts (기존 컴포넌트, 신규 사용처만 추가)"
  - "신규 design token 없음"
assets: []
open_questions: "UX Handoff와 동일"
```

## Implementation Report

```yaml
type: implementation-report
status: done
implemented_scope:
  - "apps/web/src/features/projects/ProjectPages.tsx: 삭제 버튼 클릭 시 relatedTasks.length로 분기,
     Task 있으면 AlertDialog 안내 후 종료, 없으면 기존 ConfirmDialog(문구 수정) 진행"
  - "apps/web/src/features/projects/ProjectSelect.tsx: 옵션을 project.path 존재 또는
     현재 value와 일치하는 프로젝트로 제한"
changed_contracts: []
verification:
  - "pnpm run check (turbo typecheck, 8 packages) — 통과"
  - "pnpm test — 49 tests 통과 (해당 프론트엔드 컴포넌트의 전용 단위 테스트는 저장소에 없어 typecheck +
     전체 도메인/서버 테스트로 회귀 여부 확인, apps/web에는 테스트 파일 자체가 없음)"
  - "pnpm run build / build:desktop 미실행 — 프론트엔드 전용 변경으로 서버 계약, Electron lifecycle
    변화 없음 (verification-scope 기준 최소 검증)"
deviations:
  - "요청 범위 밖이라 판단해 수정하지 않음: 빈 프로젝트 목록의 '이름만 입력해도 시작할 수 있어요'
     안내 문구는 여전히 폴더 필수 정책과 불일치 (UX Handoff open_questions 참조)"
unresolved_questions:
  - "삭제 차단 시 버튼 자체 비활성화 여부 (Decision Log 참조, 필요 시 재검토)"
```

## Review Result

```yaml
type: review-result
reviewer: "UX Designer"
status: done
acceptance_results:
  - criterion: "연결 Task가 있으면 서버 에러가 아니라 사전 안내로 삭제 불가를 안다"
    result: PASS
    evidence: "ProjectPages.tsx onClick에서 relatedTasks.length > 0이면 alert()만 호출하고 return,
      remove.mutate() 호출 경로에 도달하지 않음"
  - criterion: "삭제 확인 문구가 실제 서버 동작과 일치한다"
    result: PASS
    evidence: "ConfirmDialog description을 '삭제하면 되돌릴 수 없습니다.'로 변경, '연결 해제' 표현 제거.
      해당 분기는 relatedTasks.length === 0일 때만 도달하므로 문구와 실제 결과가 항상 일치"
  - criterion: "Task 재배정 목록은 폴더 미연결 프로젝트를 제외한다"
    result: PASS
    evidence: "ProjectSelect.tsx options 필터: project.path 없는 항목은 value와 다르면 제외됨"
  - criterion: "현재 배정된 프로젝트가 폴더 미연결이어도 재배정 드롭다운이 값을 유지한다"
    result: PASS
    evidence: "필터 조건에 project.id === value OR 포함, 현재 선택값은 항상 옵션에 남는다"
  - criterion: "ADR-005/PROJECT_IN_USE 서버 계약 미변경"
    result: PASS
    evidence: "apps/server 변경 없음 (git diff 범위가 apps/web/src/features/projects/* 두 파일로 한정됨),
      test/http.test.ts의 PROJECT_IN_USE 검증 테스트도 그대로 통과"
findings: []
remaining_risks:
  - "빈 프로젝트 목록 안내 문구가 여전히 폴더 필수 정책과 불일치 (범위 밖으로 남김)"
  - "AlertDialog가 처음 추가되는 사용처이므로 실제 데스크톱 화면에서 시각적 확인은 아직 하지 않음
    (typecheck/테스트로만 검증, 수동 UI 확인 권장)"
open_questions:
  - "삭제 차단 시 버튼 비활성화 여부 최종 확정 필요"
  - "빈 프로젝트 목록 문구 수정 여부 별도 결정 필요"
```
