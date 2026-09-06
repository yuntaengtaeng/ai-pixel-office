import styled from "styled-components";
import { Field, Fieldset, Input, Legend } from "@ai-pixel-office/design-system";
import type {
  AgentModel,
  AgentPermissions,
  ModelPolicy,
  ReasoningEffort,
} from "@ai-pixel-office/domain/entities";
import { PERMISSIONS } from "../../../shared/config/presentation.ts";
import { TechnicalDetails } from "../../../shared/ui/TechnicalDetails.tsx";
import { ModelPolicyFields } from "../ModelPolicyFields.tsx";
import { defaultManualModel } from "../model-options.ts";
import { CheckChip, CheckGrid } from "./CheckboxGrid.tsx";

const Styled = {
  Body: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  EnginePicker: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.space.x2};

    button {
      padding: ${({ theme }) => theme.space.x3};
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      border: 2px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};

      &.selected {
        border-color: ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
        color: ${({ theme }) => theme.colors.text.positive};
      }
    }

    small {
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    }
  `,
};

/** Agent 생성/수정 폼 공용 고급 설정 - 실행 엔진, 모델 정책, 도구 권한을 한 번에 다룸 */
export function AgentAdvancedOptions({
  model,
  setModel,
  modelPolicy,
  setModelPolicy,
  modelName,
  setModelName,
  reasoningEffort,
  setReasoningEffort,
  permissions,
  setPermissions,
}: {
  model: AgentModel;
  setModel: (model: AgentModel) => void;
  modelPolicy: ModelPolicy;
  setModelPolicy: (policy: ModelPolicy) => void;
  modelName: string;
  setModelName: (name: string) => void;
  reasoningEffort: ReasoningEffort;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  permissions: AgentPermissions;
  setPermissions: (permissions: AgentPermissions) => void;
}) {
  const selectEngine = (nextModel: AgentModel) => {
    setModel(nextModel);
    setModelName(defaultManualModel(nextModel));
  };
  return (
    <TechnicalDetails>
      <summary>고급 설정 · 실행 엔진과 모델</summary>
      <Styled.Body>
        <Field>
          <label>실행 엔진</label>
          <Styled.EnginePicker>
            <button
              type="button"
              className={model === "codex" ? "selected" : ""}
              onClick={() => selectEngine("codex")}
            >
              Codex <small>로컬 CLI</small>
            </button>
            <button
              type="button"
              className={model === "claude" ? "selected" : ""}
              onClick={() => selectEngine("claude")}
            >
              Claude <small>로컬 CLI</small>
            </button>
          </Styled.EnginePicker>
        </Field>
        <ModelPolicyFields
          runtime={model}
          policy={modelPolicy}
          modelName={modelName}
          reasoningEffort={reasoningEffort}
          onPolicyChange={setModelPolicy}
          onModelNameChange={setModelName}
          onReasoningEffortChange={setReasoningEffort}
        />
        <Fieldset>
          <Legend>도구 권한</Legend>
          <CheckGrid>
            {PERMISSIONS.map(({ key, label }) => {
              const required = key === "fileRead" || key === "terminal";
              return (
                <CheckChip key={key}>
                  <Input
                    type="checkbox"
                    checked={permissions[key] ?? false}
                    disabled={required}
                    onChange={(event) =>
                      setPermissions({ ...permissions, [key]: event.target.checked })
                    }
                  />
                  <span>
                    {label}
                    {required ? " · 자동 적용" : key === "figma" ? " · 연결 필요" : ""}
                  </span>
                </CheckChip>
              );
            })}
          </CheckGrid>
        </Fieldset>
      </Styled.Body>
    </TechnicalDetails>
  );
}
