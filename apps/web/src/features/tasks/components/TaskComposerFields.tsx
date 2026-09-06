import styled from "styled-components";
import { Field, Fieldset, Input, Legend } from "@ai-pixel-office/design-system";
import type { Task } from "@ai-pixel-office/domain/entities";
import { PRIORITIES, PRIORITY_COLORS } from "../../../shared/config/presentation.ts";
import { PromptSuggestions } from "../../../shared/ui/PromptSuggestions.tsx";

const RESULT_EXAMPLES = [
  {
    label: "결과물 + 변경 내용",
    value: "바로 사용할 수 있는 결과물과 변경 내용을 함께 알려 주세요.",
  },
  {
    label: "선택지 비교 + 추천",
    value: "먼저 선택지를 비교하고 가장 좋은 방법을 추천해 주세요.",
  },
  { label: "확인 방법 + 주의사항", value: "완료 후 확인 방법과 남은 주의사항을 정리해 주세요." },
];

const Styled = {
  Fields: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  PriorityPicker: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.space.x2};

    button {
      min-height: 36px;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;

      &.selected {
        border: 2px solid ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.background.positiveSubtle};
        color: ${({ theme }) => theme.colors.text.positive};
      }
    }
  `,
  PriorityChoiceDot: styled.span<{ $priority: NonNullable<Task["priority"]> }>`
    width: 7px;
    height: 7px;
    margin-right: ${({ theme }) => theme.space.x2};
    display: inline-block;
    background: ${({ $priority }) => PRIORITY_COLORS[$priority]};
  `,
  ResultField: styled(Field)`
    min-width: 0;

    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
};

export function TaskComposerFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  priority,
  onPriorityChange,
  autoFocusTitle,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  priority: NonNullable<Task["priority"]>;
  onPriorityChange: (value: NonNullable<Task["priority"]>) => void;
  autoFocusTitle?: boolean;
}) {
  return (
    <Styled.Fields>
      <Field $grow>
        <label>무엇을 만들거나 해결할까요?</label>
        <Input
          autoFocus={autoFocusTitle}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="예: 컴포넌트 추출"
          required
        />
      </Field>
      <Fieldset>
        <Legend>우선순위</Legend>
        <Styled.PriorityPicker>
          {(Object.entries(PRIORITIES) as Array<[NonNullable<Task["priority"]>, string]>).map(
            ([value, label]) => (
              <button
                type="button"
                className={priority === value ? "selected" : ""}
                key={value}
                onClick={() => onPriorityChange(value)}
              >
                <Styled.PriorityChoiceDot $priority={value} />
                {label}
              </button>
            ),
          )}
        </Styled.PriorityPicker>
      </Fieldset>
      <Styled.ResultField $grow>
        <label>원하는 결과 · 선택 사항</label>
        <Input
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="예: 선택한 화면의 버튼과 입력창을 React 컴포넌트로 분리해 주세요"
        />
        <PromptSuggestions aria-label="원하는 결과 예시">
          {RESULT_EXAMPLES.map((example) => (
            <button
              type="button"
              key={example.label}
              onClick={() => onDescriptionChange(example.value)}
            >
              {example.label}
            </button>
          ))}
        </PromptSuggestions>
      </Styled.ResultField>
    </Styled.Fields>
  );
}
