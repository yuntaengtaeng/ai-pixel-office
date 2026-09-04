import styled from "styled-components";
import type { AgentModel, ModelPolicy, ReasoningEffort } from "@ai-pixel-office/domain/entities";
import { MODEL_OPTIONS } from "./model-options.ts";

const Styled = {
  Field: styled.fieldset`
    margin: 0;
    padding: 12px;
    border: 1px solid #d4c7b7;
    background: #fffaf2;
    display: grid;
    gap: 9px;

    legend {
      padding: 0 5px;
      color: #665c54;
      font-size: 10px;
      font-weight: 800;
    }
  `,
  Picker: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;

    button {
      min-height: 36px;
      border: 1px solid #c9bcaa;
      background: #f5eee3;
      color: #74685f;
      font-weight: 800;
      cursor: pointer;

      &.selected {
        border: 2px solid #477664;
        background: #e0ece5;
        color: #315b4c;
      }
    }
  `,
  Help: styled.p`
    min-height: 30px;
    margin: 0;
    color: #7d7168;
    font-size: 9px;
    line-height: 1.55;
  `,
  ManualFields: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    label {
      display: grid;
      gap: 5px;
      color: #796b60;
      font-size: 9px;
      font-weight: 800;
    }

    select {
      padding: 8px;
      font-size: 10px;
    }

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  AutoRoutePreview: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;

    span {
      padding: 6px 4px;
      border: 1px solid #a8bdb2;
      background: #edf5f0;
      color: #466d5e;
      font-size: 8px;
      font-weight: 800;
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
            <select value={modelName} onChange={(event) => onModelNameChange(event.target.value)}>
              {MODEL_OPTIONS[runtime].map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            추론 강도
            <select
              value={reasoningEffort}
              onChange={(event) => onReasoningEffortChange(event.target.value as ReasoningEffort)}
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
              <option value="xhigh">매우 높음</option>
            </select>
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
