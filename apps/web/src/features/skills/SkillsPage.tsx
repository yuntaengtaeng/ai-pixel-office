import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/ui";
import type { Skill, Workspace } from "@ai-pixel-office/domain/entities";
import { skillApi } from "./api.ts";
import { localizeSkillCategory } from "./presentation.ts";
import { PERMISSIONS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, PageHeader } from "../../shared/ui/common.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";

const Styled = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(270px, 0.75fr) minmax(0, 1.4fr);
    gap: 20px;
    align-items: start;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  Library: styled.section`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    max-height: calc(100vh - 155px);
    overflow: auto;
    align-content: start;
    padding: 2px 7px 9px 2px;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
      max-height: none;
      overflow: visible;
      padding-right: 2px;
    }
  `,
  Card: styled.article`
    padding: 17px;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 13px;
    min-height: 210px;
    max-width: 100%;
    overflow: hidden;
  `,
  CardIcon: styled.span`
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: #e6d2a8;
    border: 2px solid #9c7952;
    box-shadow: 2px 2px 0 #c6ae83;
  `,
  CardBody: styled.div`
    min-width: 0;

    small {
      color: #9a704d;
      font: 800 9px monospace;
      text-transform: uppercase;
    }

    h3 {
      margin: 4px 0 8px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: #71675f;
      line-height: 1.5;
      overflow: hidden;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
  `,
  CardHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    button {
      padding: 4px 7px;
      border: 1px solid #c7938e;
      background: #fae9e6;
      color: #934b46;
      font-size: 9px;
      font-weight: 800;
      cursor: pointer;

      &:disabled {
        opacity: 0.55;
        cursor: wait;
      }
    }
  `,
  Bindings: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
    max-height: 51px;
    overflow: auto;

    span {
      max-width: 100%;
      padding: 4px 6px;
      border: 1px solid #b7a88f;
      background: #f2e8d7;
      color: #6f5a48;
      font-size: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span[data-kind="permission"] {
      border-color: #82a797;
      background: #dfede6;
      color: #386b59;
    }
  `,
  InstructionPreview: styled.span`
    display: -webkit-box;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #cfc2b1;
    font: 10px/1.4 monospace;
    color: #82786e;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `,
  Instructions: styled.details`
    margin-top: 8px;
    font-size: 9px;
    color: #74685f;

    summary {
      cursor: pointer;
      font-weight: 800;
      color: #4b7466;
    }

    pre {
      max-height: 190px;
      margin: 8px 0 0;
      padding: 9px;
      overflow: auto;
      border: 1px solid #cfc2b1;
      background: #f5ecdf;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 9px/1.5 monospace;
    }
  `,
  AiDraftBox: styled.div`
    padding: 13px;
    border: 2px solid #b89259;
    background: #fbf3e3;
    box-shadow: 3px 3px 0 #dfcfad;
    display: grid;
    gap: 10px;
  `,
  FormDivider: styled.span`
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8b7e74;
    font-size: 10px;

    &::before,
    &::after {
      content: "";
      height: 1px;
      flex: 1;
      background: #d8ccbc;
    }
  `,
  GeneratedSettings: styled.div`
    display: grid;
    gap: 7px;

    > label {
      color: #796b60;
      font: 800 11px monospace;
    }

    > div {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    span {
      padding: 5px 7px;
      border: 1px solid #8dad9f;
      background: #e2efe8;
      color: #3d6b5b;
      font-size: 9px;
    }
  `,
  Suggestions: styled.div`
    margin-bottom: 2px;
  `,
  Form: styled.form`
    padding: 22px;
    display: grid;
    gap: 18px;

    h2 {
      margin: 0;
    }
  `,
};

export function SkillsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("개발");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [brief, setBrief] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [requiredPermissions, setRequiredPermissions] = useState<string[]>([]);
  const draft = useMutation({
    mutationFn: () => skillApi.generateDraft(brief),
    onSuccess: (generated) => {
      setName(generated.name);
      setCategory(localizeSkillCategory(generated.category));
      setDescription(generated.description);
      setInstructions(generated.instructions);
      setTools(generated.tools);
      setRequiredPermissions(generated.requiredPermissions);
    },
  });
  const mutation = useMutation({
    mutationFn: () =>
      skillApi.create({
        workspaceId: workspace.id,
        name,
        category,
        description,
        instructions,
        tools: tools.map((tool) => ({ name: tool })),
        requiredPermissions,
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setInstructions("");
      setBrief("");
      setTools([]);
      setRequiredPermissions([]);
      void queryClient.invalidateQueries({ queryKey: ["skills", workspace.id] });
    },
  });
  const removeSkill = useMutation({
    mutationFn: (id: string) => skillApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skills", workspace.id] }),
  });
  return (
    <BaseLayout>
      <PageHeader eyebrow="CAPABILITY LIBRARY" title="스킬 작업실" />
      <Styled.Layout>
        <Styled.Form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <h2>AI로 새 스킬 만들기</h2>
          <Styled.AiDraftBox>
            <div className="field">
              <label>이 스킬이 반복해서 어떤 일을 잘했으면 하나요?</label>
              <textarea
                rows={3}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    brief.trim() &&
                    !draft.isPending
                  ) {
                    event.preventDefault();
                    draft.mutate();
                  }
                }}
                placeholder="예: Figma 링크를 받으면 간격과 타이포그래피를 검토하고 개선안을 정리해 줘"
              />
            </div>
            <Styled.Suggestions className="prompt-suggestions">
              {[
                "Figma 화면의 사용성과 일관성을 검토해 줘",
                "React 화면에서 재사용할 컴포넌트를 찾아 분리해 줘",
                "회의 내용을 결정 사항과 할 일로 정리해 줘",
              ].map((example) => (
                <button type="button" key={example} onClick={() => setBrief(example)}>
                  {example}
                </button>
              ))}
            </Styled.Suggestions>
            <Button
              type="button"
              $variant="secondary"
              $fullWidth
              disabled={!brief.trim() || draft.isPending}
              onClick={() => draft.mutate()}
            >
              {draft.isPending ? "AI가 초안을 만드는 중..." : "✦ AI로 초안 만들기"}
            </Button>
            {draft.isError && <ErrorBanner>{messageOf(draft.error)}</ErrorBanner>}
          </Styled.AiDraftBox>
          <Styled.FormDivider>AI 초안을 확인하고 필요하면 수정하세요</Styled.FormDivider>
          <div className="field">
            <label>이름</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: React 컴포넌트 제작"
              required
            />
          </div>
          <div className="field">
            <label>카테고리</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>개발</option>
              <option>디자인</option>
              <option>조사</option>
              <option>문서</option>
              <option>운영</option>
              <option>기타</option>
            </select>
          </div>
          <div className="field">
            <label>설명</label>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="언제 사용하는 스킬인가요?"
              required
            />
          </div>
          <div className="field">
            <label>지시문</label>
            <textarea
              rows={7}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="에이전트가 따라야 할 구체적인 절차를 적어 주세요."
              required
            />
          </div>
          {(tools.length > 0 || requiredPermissions.length > 0) && (
            <Styled.GeneratedSettings>
              <label>AI가 제안한 연결</label>
              <div>
                {tools.map((tool) => (
                  <span key={tool}>도구 · {tool}</span>
                ))}
                {requiredPermissions.map((permission) => (
                  <span key={permission}>권한 · {permission}</span>
                ))}
              </div>
            </Styled.GeneratedSettings>
          )}
          <Button $variant="primary" $fullWidth disabled={mutation.isPending}>
            스킬 저장
          </Button>
          {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
        </Styled.Form>
        <Styled.Library>
          {removeSkill.isError && <ErrorBanner>{messageOf(removeSkill.error)}</ErrorBanner>}
          {(skills.data ?? []).map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              deleting={removeSkill.isPending && removeSkill.variables === skill.id}
              onDelete={async () => {
                if (
                  await confirm({
                    title: `${skill.name} 스킬을 삭제할까요?`,
                    description: "에이전트가 사용 중인 스킬은 먼저 연결을 해제해야 합니다.",
                    confirmLabel: "스킬 삭제",
                    tone: "danger",
                  })
                )
                  removeSkill.mutate(skill.id);
              }}
            />
          ))}
          {skills.data?.length === 0 && (
            <div className="panel">
              <Empty>첫 번째 스킬을 만들어 보세요.</Empty>
            </div>
          )}
        </Styled.Library>
      </Styled.Layout>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}

function SkillCard({
  skill,
  deleting,
  onDelete,
}: {
  skill: Skill;
  deleting: boolean;
  onDelete: () => void;
}) {
  const bindings = [
    ...skill.tools.map((tool) => ({
      key: `tool-${tool.name}`,
      label: `도구 · ${tool.name}`,
      kind: "tool",
    })),
    ...(skill.requiredPermissions ?? []).map((permission) => ({
      key: `permission-${permission}`,
      label: `권장 권한 · ${PERMISSIONS.find((item) => item.key === permission)?.label ?? permission}`,
      kind: "permission",
    })),
  ];
  return (
    <Styled.Card className="panel">
      <Styled.CardIcon>✦</Styled.CardIcon>
      <Styled.CardBody>
        <Styled.CardHeader>
          <small>{localizeSkillCategory(skill.category)}</small>
          <button type="button" disabled={deleting} onClick={onDelete}>
            {deleting ? "삭제 중" : "삭제"}
          </button>
        </Styled.CardHeader>
        <h3 title={skill.name}>{skill.name}</h3>
        <p title={skill.description}>{skill.description}</p>
        {bindings.length > 0 && (
          <Styled.Bindings>
            {bindings.map((binding) => (
              <span data-kind={binding.kind} key={binding.key}>
                {binding.label}
              </span>
            ))}
          </Styled.Bindings>
        )}
        <Styled.InstructionPreview>{skill.instructions}</Styled.InstructionPreview>
        <Styled.Instructions>
          <summary>전체 지시문 보기</summary>
          <pre>{skill.instructions}</pre>
        </Styled.Instructions>
      </Styled.CardBody>
    </Styled.Card>
  );
}
