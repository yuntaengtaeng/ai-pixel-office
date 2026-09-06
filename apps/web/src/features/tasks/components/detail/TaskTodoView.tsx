import { TaskSessionComposer } from "./TaskSessionComposer.tsx";

export function TaskTodoView({
  value,
  originalValue,
  savePending,
  onChange,
  onSave,
}: {
  value: string;
  originalValue: string;
  savePending: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <TaskSessionComposer
      id="task-brief"
      title="에이전트에게 전달할 작업 목표"
      description="배경, 원하는 결과, 지켜야 할 조건을 적어 주세요. 작업 시작 시 자동 저장됩니다."
      value={value}
      placeholder="예: 현재 UI 구조를 먼저 확인하고, 기존 컴포넌트 스타일을 유지하면서 개선해 주세요."
      submitLabel="메시지 저장"
      submittingLabel="저장 중"
      pending={savePending}
      disabled={value.trim() === originalValue.trim()}
      helper="저장한 내용은 작업을 시작하기 전에도 다시 편집할 수 있어요."
      onChange={onChange}
      onSubmit={onSave}
    />
  );
}
