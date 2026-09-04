import type {
  AgentModel,
  ModelPolicy,
  ReasoningEffort,
} from "../../../../../packages/domain/src/entities.ts";
import { MODEL_OPTIONS } from "./model-options.ts";

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
    <fieldset className="model-policy-field">
      <legend>모델 선택</legend>
      <div className="model-policy-picker">
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
      </div>
      <p className="model-policy-help">
        {policy === "default"
          ? "Codex·Claude CLI에 설정된 기본 모델을 그대로 사용합니다."
          : policy === "auto"
            ? "작업 우선순위에 맞춰 빠른·균형·고성능 모델과 추론 강도를 자동 선택합니다."
            : "이 에이전트가 항상 사용할 모델과 추론 강도를 직접 정합니다."}
      </p>
      {policy === "manual" && (
        <div className="manual-model-fields">
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
        </div>
      )}
      {policy === "auto" && (
        <div className="auto-route-preview">
          <span>낮음 → {runtime === "codex" ? "Luna" : "Haiku"}</span>
          <span>보통 → {runtime === "codex" ? "Terra" : "Sonnet"}</span>
          <span>높음 → {runtime === "codex" ? "Sol" : "Opus"}</span>
        </div>
      )}
    </fieldset>
  );
}
