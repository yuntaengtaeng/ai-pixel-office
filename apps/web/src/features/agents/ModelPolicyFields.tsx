import { mediaQuery } from "@ai-pixel-office/design-token";
import styled from "styled-components";
import { Select } from "@ai-pixel-office/ui";
import type { AgentModel, ModelPolicy, ReasoningEffort } from "@ai-pixel-office/domain/entities";
import { MODEL_OPTIONS } from "./model-options.ts";

const Styled = {
  Field: styled.fieldset`
    margin: 0;
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    gap: 8px;

    legend {
      padding: 0 4px;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  Picker: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

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
  Help: styled.p`
    min-height: 30px;
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    line-height: 1.55;
  `,
  ManualFields: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    label {
      display: grid;
      gap: 4px;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    select {
      padding: 8px;
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }

    @media ${mediaQuery.mobile} {
      grid-template-columns: 1fr;
    }
  `,
  AutoRoutePreview: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;

    span {
      padding: 8px 4px;
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      text-align: center;
    }
  `,
};

export function ModelPolicyFields({
  runtime,
  policy,
  modelName,
  reasoningEffort,
  onPolicyChange,
  onModelNameChange,
  onReasoningEffortChange,
}: {
  runtime: AgentModel;
  policy: ModelPolicy;
  modelName: string;
  reasoningEffort: ReasoningEffort;
  onPolicyChange: (value: ModelPolicy) => void;
  onModelNameChange: (value: string) => void;
  onReasoningEffortChange: (value: ReasoningEffort) => void;
}) {
  return (
    <Styled.Field>
      <legend>모델 선택</legend>
      <Styled.Picker>
        {(
          [
            ["default", "기본값"],
            ["auto", "자동"],
            ["manual", "수동"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            className={policy === value ? "selected" : ""}
            key={value}
            onClick={() => onPolicyChange(value)}
          >
            {label}
          </button>
        ))}
      </Styled.Picker>
      <Styled.Help>
        {policy === "default"
          ? "Codex·Claude CLI에 설정된 기본 모델을 그대로 사용합니다."
          : policy === "auto"
            ? "작업 우선순위에 맞춰 빠른·균형·고성능 모델과 추론 강도를 자동 선택합니다."
            : "이 에이전트가 항상 사용할 모델과 추론 강도를 직접 정합니다."}
      </Styled.Help>
      {policy === "manual" && (
        <Styled.ManualFields>
          <label>
            모델
            <Select value={modelName} onChange={(event) => onModelNameChange(event.target.value)}>
              {MODEL_OPTIONS[runtime].map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label>
            추론 강도
            <Select
              value={reasoningEffort}
              onChange={(event) => onReasoningEffortChange(event.target.value as ReasoningEffort)}
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
              <option value="xhigh">매우 높음</option>
            </Select>
          </label>
        </Styled.ManualFields>
      )}
      {policy === "auto" && (
        <Styled.AutoRoutePreview>
          <span>낮음 → {runtime === "codex" ? "Luna" : "Haiku"}</span>
          <span>보통 → {runtime === "codex" ? "Terra" : "Sonnet"}</span>
          <span>높음 → {runtime === "codex" ? "Sol" : "Opus"}</span>
        </Styled.AutoRoutePreview>
      )}
    </Styled.Field>
  );
}
