import { Button, Input, Select } from "@ai-pixel-office/design-system";
import type { Agent, WorkflowPreset } from "@ai-pixel-office/domain/entities";
import { useEffect, useState, type ReactNode } from "react";
import type { TaskDetail } from "../../api.ts";
import { SectionHeading } from "../../../../shared/ui/SectionHeading.tsx";
import { WorkflowProgressStep } from "../results/WorkflowProgressStep.tsx";

import styled from "styled-components";

const Styled = {
  WorkflowPanel: styled.section`
    margin-bottom: ${({ theme }) => theme.space.x5};
    padding-bottom: ${({ theme }) => theme.space.x4};
    border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};
  `,
  AssignmentSecondaryToggle: styled.label`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x3};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    cursor: pointer;

    input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: ${({ theme }) => theme.colors.brand.primary};
    }

    &:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,
  WorkflowEmpty: styled.p`
    margin: ${({ theme }) => `${theme.space.x2} 0 0`};
    color: ${({ theme }) => theme.colors.text.negative};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    line-height: 1.5;
  `,
  WorkflowProgressList: styled.ol`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      gap: ${({ theme }) => theme.space.x2};
      align-items: start;
      position: relative;

      > span {
        width: 23px;
        height: 23px;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
        display: grid;
        place-items: center;
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.micro};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }

      > div {
        min-width: 0;
        display: grid;
        gap: ${({ theme }) => theme.space.x1};
        padding-bottom: ${({ theme }) => theme.space.x2};
      }

      strong {
        font-size: ${({ theme }) => theme.typography.fontSize.sm};
      }

      small {
        color: ${({ theme }) => theme.colors.text.muted};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
      }

      p {
        max-height: 34px;
        margin: ${({ theme }) => `${theme.space.x1} 0 0`};
        overflow: hidden;
        color: ${({ theme }) => theme.colors.text.secondary};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
        line-height: 1.4;
      }

      &.has-result {
        cursor: pointer;

        &:hover > div strong {
          color: ${({ theme }) => theme.colors.text.positive};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      }

      &:not(:last-child)::after {
        content: "";
        position: absolute;
        left: 11px;
        top: 24px;
        width: 2px;
        height: calc(100% - 14px);
        background: ${({ theme }) => theme.colors.shadow.default};
      }

      &[data-status="working"] > span {
        border-color: ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.background.surfaceMuted};
      }

      &[data-status="completed"] > span {
        border-color: ${({ theme }) => theme.colors.border.positive};
        background: ${({ theme }) => theme.colors.brand.primary};
        color: white;
      }

      &[data-status="failed"] > span {
        border-color: ${({ theme }) => theme.colors.border.negative};
        background: ${({ theme }) => theme.colors.semantic.negative};
        color: white;
      }
    }
  `,
  WorkflowEditor: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    margin: 0;
    padding: 0;
  `,
  WorkflowPresetPicker: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};

    label {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    > div {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: ${({ theme }) => theme.space.x1};
    }

    select {
      min-width: 0;
      height: 32px;
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border-width: 1px;
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  WorkflowPresetDelete: styled.button`
    padding: ${({ theme }) => `0 ${theme.space.x2}`};
    border: 1px solid ${({ theme }) => theme.colors.border.negative};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.negative};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,
  WorkflowEditorStep: styled.div`
    min-width: 0;
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  WorkflowStepMain: styled.div`
    min-width: 0;
    display: grid;
    grid-template-columns: 25px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x2};
    align-items: center;

    > span {
      width: 23px;
      height: 23px;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
      display: grid;
      place-items: center;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    select {
      width: 100%;
      min-width: 0;
      height: 34px;
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  WorkflowStepControls: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x1};

    > span {
      min-width: 0;
      margin-right: auto;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    button {
      flex: 0 0 27px;
      width: 27px;
      height: 26px;
      padding: 0;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }
  `,
  WorkflowAddStep: styled.button`
    width: 100%;
    padding: ${({ theme }) => theme.space.x2};
    border: 1px dashed ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.positive};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  `,
  WorkflowPresetSave: styled.form`
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x1};

    input {
      min-width: 0;
      padding: ${({ theme }) => theme.space.x2};
      border-width: 1px;
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }

    button {
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      white-space: nowrap;
    }
  `,
  WorkflowEditorActions: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x1};

    button {
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  WorkflowMessage: styled.small`
    display: block;
    margin: ${({ theme }) => `${theme.space.x2} 0 0`};
    color: ${({ theme }) => theme.colors.text.negative};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    line-height: 1.5;
  `,
  WorkflowSummary: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    ol {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      min-width: 0;
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      align-items: center;
      gap: ${({ theme }) => theme.space.x2};
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};

      span {
        color: ${({ theme }) => theme.colors.text.positive};
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.micro};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }

      strong {
        overflow: hidden;
        font-size: ${({ theme }) => theme.typography.fontSize.micro};
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `,
};

export function WorkflowPanel({
  task,
  agents,
  saving,
  onSave,
  presets,
  presetSaving,
  onCreatePreset,
  onDeletePreset,
  singleAssignment,
}: {
  task: TaskDetail;
  agents: Agent[];
  saving: boolean;
  onSave: (agentIds: string[]) => void;
  presets: WorkflowPreset[];
  presetSaving: boolean;
  onCreatePreset: (name: string, agentIds: string[]) => void;
  onDeletePreset: (preset: WorkflowPreset) => void;
  singleAssignment: ReactNode;
}) {
  const [agentIds, setAgentIds] = useState(() => task.workflow.map((step) => step.agentId));
  const [editing, setEditing] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const editable = task.status === "todo" && task.runs.length === 0;
  useEffect(() => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  }, [task.workflow]);
  const startConfiguring = () => {
    const first = task.assigneeAgentId ?? agents[0]?.id;
    const second = agents.find((agent) => agent.id !== first)?.id;
    setAgentIds([first, second].filter((id): id is string => Boolean(id)));
    setEditing(true);
  };
  const updateAgent = (position: number, agentId: string) => {
    setSelectedPresetId("");
    setAgentIds((current) => current.map((id, index) => (index === position ? agentId : id)));
  };
  const move = (position: number, direction: -1 | 1) => {
    setSelectedPresetId("");
    setAgentIds((current) => {
      const target = position + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[position], next[target]] = [next[target]!, next[position]!];
      return next;
    });
  };
  const hasDuplicates = new Set(agentIds).size !== agentIds.length;
  const sequential = task.workflow.length > 0 || editing;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const cancelEditing = () => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  };
  const chooseSingle = () => {
    if (task.workflow.length > 0) onSave([]);
    else cancelEditing();
  };

  return (
    <Styled.WorkflowPanel>
      <SectionHeading $compact>
        <h2>담당 방식</h2>
      </SectionHeading>
      {!sequential ? (
        (singleAssignment ?? (
          <Styled.WorkflowEmpty>한 명이 이 작업을 담당합니다.</Styled.WorkflowEmpty>
        ))
      ) : task.workflow.length > 0 && !editable ? (
        <Styled.WorkflowProgressList>
          {task.workflow.map((step) => (
            <WorkflowProgressStep
              key={step.id}
              step={step}
              agent={agents.find((a) => a.id === step.agentId)}
            />
          ))}
        </Styled.WorkflowProgressList>
      ) : editing ? (
        <Styled.WorkflowEditor>
          <Styled.WorkflowPresetPicker>
            <label htmlFor="workflow-preset">저장된 협업 그룹</label>
            <div>
              <Select
                id="workflow-preset"
                value={selectedPresetId}
                onChange={(event) => {
                  const preset = presets.find((entry) => entry.id === event.target.value);
                  setSelectedPresetId(event.target.value);
                  if (preset) setAgentIds(preset.agentIds);
                }}
              >
                <option value="">직접 순서 구성</option>
                {presets.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    disabled={preset.agentIds.some(
                      (id) => !agents.some((agent) => agent.id === id),
                    )}
                  >
                    {preset.name} · {preset.agentIds.length}명
                  </option>
                ))}
              </Select>
              <Styled.WorkflowPresetDelete
                type="button"
                disabled={!selectedPreset || presetSaving}
                onClick={() => selectedPreset && onDeletePreset(selectedPreset)}
                aria-label="선택한 협업 그룹 삭제"
              >
                삭제
              </Styled.WorkflowPresetDelete>
            </div>
          </Styled.WorkflowPresetPicker>
          {agentIds.map((agentId, position) => (
            <Styled.WorkflowEditorStep key={`${position}-${agentId}`}>
              <Styled.WorkflowStepMain>
                <span>{position + 1}</span>
                <Select
                  value={agentId}
                  onChange={(event) => updateAgent(position, event.target.value)}
                >
                  {agents.map((agent) => (
                    <option value={agent.id} key={agent.id}>
                      {agent.name} · {agent.role}
                    </option>
                  ))}
                </Select>
              </Styled.WorkflowStepMain>
              <Styled.WorkflowStepControls>
                <span>
                  {position === agentIds.length - 1 ? "최종 단계" : "완료 후 다음 단계로 전달"}
                </span>
                <button
                  type="button"
                  onClick={() => move(position, -1)}
                  disabled={position === 0}
                  aria-label="앞 단계로 이동"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(position, 1)}
                  disabled={position === agentIds.length - 1}
                  aria-label="뒤 단계로 이동"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPresetId("");
                    setAgentIds((current) => current.filter((_, index) => index !== position));
                  }}
                  disabled={agentIds.length <= 2}
                  title={agentIds.length <= 2 ? "순차 협업에는 최소 2명이 필요합니다." : undefined}
                  aria-label="단계 삭제"
                >
                  ×
                </button>
              </Styled.WorkflowStepControls>
            </Styled.WorkflowEditorStep>
          ))}
          <Styled.WorkflowAddStep
            type="button"
            disabled={agentIds.length >= Math.min(8, agents.length)}
            onClick={() => {
              const next = agents.find((agent) => !agentIds.includes(agent.id));
              if (next) {
                setSelectedPresetId("");
                setAgentIds((current) => [...current, next.id]);
              }
            }}
          >
            + 다음 단계 추가
          </Styled.WorkflowAddStep>
          <Styled.WorkflowPresetSave
            onSubmit={(event) => {
              event.preventDefault();
              if (presetName.trim() && agentIds.length >= 2 && !hasDuplicates && !presetSaving) {
                onCreatePreset(presetName, agentIds);
                setPresetName("");
              }
            }}
          >
            <Input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="이 순서의 그룹 이름"
              aria-label="협업 그룹 이름"
            />
            <Button
              type="submit"
              $variant="secondary"
              disabled={!presetName.trim() || agentIds.length < 2 || hasDuplicates || presetSaving}
            >
              그룹 저장
            </Button>
          </Styled.WorkflowPresetSave>
          <Styled.WorkflowEditorActions>
            <Button type="button" $variant="secondary" onClick={cancelEditing}>
              편집 취소
            </Button>
            <Button
              type="button"
              $variant="primary"
              disabled={saving || agentIds.length < 2 || hasDuplicates}
              onClick={() => onSave(agentIds)}
            >
              순서 저장
            </Button>
          </Styled.WorkflowEditorActions>
          {hasDuplicates && (
            <Styled.WorkflowMessage>
              같은 에이전트를 중복 배치할 수 없습니다.
            </Styled.WorkflowMessage>
          )}
        </Styled.WorkflowEditor>
      ) : task.workflow.length > 0 ? (
        <Styled.WorkflowSummary>
          <ol>
            {task.workflow.map((step) => (
              <li key={step.id}>
                <span>{step.position + 1}</span>
                <strong>
                  {agents.find((agent) => agent.id === step.agentId)?.name ?? "삭제된 에이전트"}
                </strong>
              </li>
            ))}
          </ol>
          <Button type="button" $variant="secondary" $fullWidth onClick={() => setEditing(true)}>
            협업 순서 편집
          </Button>
        </Styled.WorkflowSummary>
      ) : (
        <Styled.WorkflowEmpty>
          {agents.length < 2
            ? "순차 협업에는 에이전트가 2명 이상 필요합니다."
            : "이 작업은 단일 에이전트로 진행됩니다."}
        </Styled.WorkflowEmpty>
      )}
      {editable && !editing && (
        <Styled.AssignmentSecondaryToggle>
          <input
            type="checkbox"
            checked={sequential}
            disabled={agents.length < 2 || saving}
            onChange={() => {
              if (sequential) chooseSingle();
              else startConfiguring();
            }}
          />
          여러 명이 순서대로 진행하기
        </Styled.AssignmentSecondaryToggle>
      )}
    </Styled.WorkflowPanel>
  );
}
