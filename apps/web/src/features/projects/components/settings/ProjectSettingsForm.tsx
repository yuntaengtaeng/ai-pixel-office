import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, Input, Select, TextArea } from "@ai-pixel-office/design-system";
import type { Agent, Project } from "@ai-pixel-office/domain/entities";
import { projectApi } from "../../api.ts";
import { systemApi } from "../../../system/api.ts";
import { candidateValues, toggleValue } from "../../utils/projectSettings.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { CheckList } from "../../../../shared/ui/CheckList.tsx";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";
import { PanelSection } from "../../../../shared/ui/PanelSection.tsx";
import { PathChip } from "../../../../shared/ui/PathChip.tsx";

const Styled = {
  Form: styled.form`
    max-width: 760px;
    display: grid;
    gap: ${({ theme }) => theme.space.x8};
  `,
  Hint: styled.small`
    color: ${({ theme }) => theme.colors.text.muted};
  `,
  Inline: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    input {
      flex: 1;
      min-width: 200px;
    }
  `,
  Actions: styled.div`
    position: sticky;
    bottom: 0;
    padding: ${({ theme }) => `${theme.space.x3} 0`};
    background: ${({ theme }) => theme.colors.background.canvas};
  `,
};

/** 프로젝트 설정 (일반, 기본 담당, 프로젝트 메모, 확인 방법, 작업 공간 준비, 화면 미리보기) */
export function ProjectSettingsForm({
  project,
  agents,
  onSaved,
}: {
  project: Project;
  /** 기본 담당으로 고를 수 있는 동료 */
  agents: Agent[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<Project["status"]>(project.status);
  const [figmaUrl, setFigmaUrl] = useState(project.figmaUrl ?? "");
  const [memo, setMemo] = useState(project.memo ?? "");
  const [checks, setChecks] = useState(project.verificationCommands);
  const [extraCheck, setExtraCheck] = useState("");
  const [setupCommand, setSetupCommand] = useState(project.setupCommand ?? "");
  const [copyFiles, setCopyFiles] = useState(project.copyFiles);
  const [extraFile, setExtraFile] = useState("");
  const [defaultAgentId, setDefaultAgentId] = useState(project.defaultAgentId ?? "");
  const [previewUrl, setPreviewUrl] = useState(project.previewUrl ?? "");
  const [leadRuntime, setLeadRuntime] = useState<string>(project.leadRuntime ?? "");
  const suggestions = useQuery({
    queryKey: ["project-setup-suggestions", project.id],
    queryFn: () => projectApi.setupSuggestions(project.id),
    enabled: Boolean(project.path),
  });
  const save = useMutation({
    mutationFn: () =>
      projectApi.update(project.id, {
        name: name.trim(),
        description: description.trim(),
        status,
        figmaUrl: figmaUrl.trim(),
        memo: memo.trim(),
        verificationCommands: checks,
        setupCommand: setupCommand.trim(),
        copyFiles,
        defaultAgentId: defaultAgentId || null,
        previewUrl: previewUrl.trim(),
        leadRuntime: leadRuntime === "claude" || leadRuntime === "codex" ? leadRuntime : null,
      }),
    onSuccess: onSaved,
  });
  const changeFolder = useMutation({
    mutationFn: async () => {
      const picked = await systemApi.pickDirectory(project.path);
      if (picked.path) await projectApi.update(project.id, { path: picked.path });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-setup-suggestions", project.id] });
      onSaved();
    },
  });
  const suggested = suggestions.data;
  const addExtra = (value: string, add: (value: string) => void, reset: () => void) => {
    if (value.trim()) add(value.trim());
    reset();
  };

  return (
    <Styled.Form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && !save.isPending) save.mutate();
      }}
    >
      <PanelSection title="일반">
        <Field>
          <label htmlFor="project-name">이름</label>
          <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          <label>작업 폴더</label>
          <Styled.Inline>
            <PathChip path={project.path ?? "연결된 폴더 없음"} />
            <Button
              type="button"
              $variant="secondary"
              disabled={changeFolder.isPending}
              onClick={() => changeFolder.mutate()}
            >
              {project.path ? "폴더 바꾸기" : "폴더 연결"}
            </Button>
          </Styled.Inline>
          <Styled.Hint>
            이 프로젝트의 모든 요청은 이 폴더에서 작업해요. 실행한 기안서가 생기면 바꿀 수 없어요.
            {suggested &&
              (suggested.isolated
                ? " Git 저장소라 기안서마다 작업 공간에서 격리해 실행해요."
                : " Git 저장소가 아니라 결재 전 변경이 폴더에 바로 남아요.")}
          </Styled.Hint>
        </Field>
        <Field>
          <label htmlFor="project-description">한 줄 설명</label>
          <Input
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field>
          <label htmlFor="project-status">상태</label>
          <Select
            id="project-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as Project["status"])}
          >
            <option value="active">진행 중</option>
            <option value="paused">잠시 멈춤</option>
            <option value="done">완료</option>
          </Select>
        </Field>
        <Field>
          <label htmlFor="project-figma">Figma 링크</label>
          <Input
            id="project-figma"
            value={figmaUrl}
            placeholder="선택 사항"
            onChange={(event) => setFigmaUrl(event.target.value)}
          />
        </Field>
      </PanelSection>

      <PanelSection title="프로젝트 메모">
        <Field>
          <label htmlFor="project-memo">동료들이 이 프로젝트에서 꼭 알아야 할 것</label>
          <TextArea
            id="project-memo"
            rows={5}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
          <Styled.Hint>
            저장소의 AGENTS.md, CLAUDE.md는 동료가 따로 읽으니 사람이 아는 맥락만 적어 주세요.
          </Styled.Hint>
        </Field>
      </PanelSection>

      <PanelSection title="확인 방법">
        <CheckList
          label="바꾼 뒤 확인할 명령"
          values={candidateValues(checks, suggested?.verificationCommands ?? [])}
          checked={checks}
          onToggle={(value, on) => setChecks((current) => toggleValue(current, value, on))}
        />
        <Styled.Inline>
          <Input
            aria-label="확인 명령 직접 추가"
            placeholder="예) pnpm test:unit"
            value={extraCheck}
            onChange={(event) => setExtraCheck(event.target.value)}
          />
          <Button
            type="button"
            $variant="secondary"
            onClick={() =>
              addExtra(
                extraCheck,
                (value) => setChecks((current) => toggleValue(current, value, true)),
                () => setExtraCheck(""),
              )
            }
          >
            추가
          </Button>
        </Styled.Inline>
        <Styled.Hint>
          고른 명령의 결과가 기안서의 "확인 결과"에 남고, 실패하면 담당 동료에게 한 번 되돌려
          보내요.
        </Styled.Hint>
      </PanelSection>

      <PanelSection title="팀장">
        <Field>
          <label htmlFor="project-lead-runtime">팀장이 쓸 AI</label>
          <Select
            id="project-lead-runtime"
            value={leadRuntime}
            onChange={(event) => setLeadRuntime(event.target.value)}
          >
            <option value="">기본 동료와 같게</option>
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </Select>
          <Styled.Hint>
            팀장은 프로젝트 폴더를 읽기만 하고, 계획서를 올려 동료에게 일을 나눠요.
          </Styled.Hint>
        </Field>
      </PanelSection>

      <PanelSection title="기본 담당">
        <Field>
          <label htmlFor="project-default-assignee">
            이 프로젝트에 요청할 때 먼저 골라 둘 동료
          </label>
          <Select
            id="project-default-assignee"
            value={defaultAgentId}
            onChange={(event) => setDefaultAgentId(event.target.value)}
          >
            <option value="">정하지 않음</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.role}
              </option>
            ))}
          </Select>
          <Styled.Hint>
            새 요청 화면에서 이 프로젝트를 고르면 담당이 이렇게 채워져요. 바꿔서 맡겨도 돼요.
          </Styled.Hint>
        </Field>
      </PanelSection>

      <PanelSection title="작업 공간 준비">
        <Field>
          <label htmlFor="project-setup">준비 명령</label>
          <Styled.Inline>
            <Input
              id="project-setup"
              placeholder="예) pnpm install"
              value={setupCommand}
              onChange={(event) => setSetupCommand(event.target.value)}
            />
            {suggested?.setupCommand && suggested.setupCommand !== setupCommand && (
              <Button
                type="button"
                $variant="secondary"
                onClick={() => setSetupCommand(suggested.setupCommand ?? "")}
              >
                {suggested.setupCommand} 쓰기
              </Button>
            )}
          </Styled.Inline>
          <Styled.Hint>동료가 작업 공간에서 일하기 직전에 한 번 실행해요.</Styled.Hint>
        </Field>
        <Field>
          <label>가져올 파일</label>
          <CheckList
            label="작업 공간으로 복사할 파일"
            values={candidateValues(copyFiles, suggested?.copyFiles ?? [])}
            checked={copyFiles}
            onToggle={(value, on) => setCopyFiles((current) => toggleValue(current, value, on))}
          />
          <Styled.Inline>
            <Input
              aria-label="가져올 파일 직접 추가"
              placeholder="예) .env.local"
              value={extraFile}
              onChange={(event) => setExtraFile(event.target.value)}
            />
            <Button
              type="button"
              $variant="secondary"
              onClick={() =>
                addExtra(
                  extraFile,
                  (value) => setCopyFiles((current) => toggleValue(current, value, true)),
                  () => setExtraFile(""),
                )
              }
            >
              추가
            </Button>
          </Styled.Inline>
          <Styled.Hint>
            작업 공간에는 Git이 무시하는 파일(.env 등)이 없어요. 필요한 파일만 복사해요.
          </Styled.Hint>
        </Field>
      </PanelSection>

      <PanelSection title="화면 미리보기">
        <Field>
          <label htmlFor="project-preview">미리보기 주소</label>
          <Input
            id="project-preview"
            placeholder="예) http://localhost:5173"
            value={previewUrl}
            onChange={(event) => setPreviewUrl(event.target.value)}
          />
          <Styled.Hint>
            이 프로젝트를 실행해 둔 주소예요. 프로젝트 화면 머리말에서 바로 열 수 있어요. 작업
            공간에서 고친 내용은 결재해서 프로젝트 폴더에 반영된 뒤에 보여요.
          </Styled.Hint>
        </Field>
      </PanelSection>

      <Styled.Actions>
        <Button $variant="primary" type="submit" disabled={!name.trim() || save.isPending}>
          {save.isPending ? "저장하는 중" : "설정 저장"}
        </Button>
      </Styled.Actions>
      {(save.error ?? changeFolder.error) && (
        <ErrorBanner>{messageOf(save.error ?? changeFolder.error)}</ErrorBanner>
      )}
    </Styled.Form>
  );
}
