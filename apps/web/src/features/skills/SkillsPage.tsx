import { mediaQuery } from "@ai-pixel-office/design-system";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, Input, Panel, Select, TextArea } from "@ai-pixel-office/design-system";
import type { Skill, Workspace } from "@ai-pixel-office/domain/entities";
import { skillApi } from "./api.ts";
import { localizeSkillCategory } from "./presentation.ts";
import { PERMISSIONS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { isSubmitKey } from "../../shared/lib/keyboard.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { PromptSuggestions } from "../../shared/ui/PromptSuggestions.tsx";

const Styled = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(270px, 0.75fr) minmax(0, 1.4fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  Library: styled.section`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x4};
    max-height: calc(100vh - 155px);
    overflow: auto;
    align-content: start;
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2} ${theme.space.x2} ${theme.space.x1}`};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
      max-height: none;
      overflow: visible;
      padding-right: ${({ theme }) => theme.space.x1};
    }
  `,
  Card: styled(Panel).attrs({ as: "article" })`
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x3};
    min-height: 210px;
    max-width: 100%;
    overflow: hidden;
  `,
  CardIcon: styled.span`
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    border: 2px solid ${({ theme }) => theme.colors.border.default};
    box-shadow: 2px 2px 0 ${({ theme }) => theme.colors.border.default};
  `,
  CardBody: styled.div`
    min-width: 0;

    small {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      text-transform: uppercase;
    }

    h3 {
      margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x2}`};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    p {
      margin: 0;
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      color: ${({ theme }) => theme.colors.text.secondary};
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
    gap: ${({ theme }) => theme.space.x2};

    button {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.negative};
      background: ${({ theme }) => theme.colors.background.negativeSubtle};
      color: ${({ theme }) => theme.colors.text.negative};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
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
    gap: ${({ theme }) => theme.space.x1};
    margin-top: ${({ theme }) => theme.space.x3};
    max-height: 51px;
    overflow: auto;

    span {
      max-width: 100%;
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span[data-kind="permission"] {
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
    }
  `,
  InstructionPreview: styled.span`
    display: -webkit-box;
    margin-top: ${({ theme }) => theme.space.x3};
    padding-top: ${({ theme }) => theme.space.x2};
    border-top: 1px dashed ${({ theme }) => theme.colors.border.default};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    line-height: 1.4;
    color: ${({ theme }) => theme.colors.text.secondary};
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `,
  Instructions: styled.details`
    margin-top: ${({ theme }) => theme.space.x2};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    color: ${({ theme }) => theme.colors.text.secondary};

    summary {
      cursor: pointer;
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      color: ${({ theme }) => theme.colors.text.positive};
    }

    pre {
      max-height: 190px;
      margin: ${({ theme }) => `${theme.space.x2} 0 0`};
      padding: ${({ theme }) => theme.space.x2};
      overflow: auto;
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      line-height: 1.5;
    }
  `,
  AiDraftBox: styled.div`
    padding: ${({ theme }) => theme.space.x3};
    border: 2px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.border.subtle};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  FormDivider: styled.span`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};

    &::before,
    &::after {
      content: "";
      height: 1px;
      flex: 1;
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
    }
  `,
  GeneratedSettings: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    > label {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    > div {
      display: flex;
      gap: ${({ theme }) => theme.space.x2};
      flex-wrap: wrap;
    }

    span {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      border: 1px solid ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.positiveSubtle};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  Suggestions: styled(PromptSuggestions)`
    margin-bottom: ${({ theme }) => theme.space.x1};
  `,
  Form: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x6};
    display: grid;
    gap: ${({ theme }) => theme.space.x5};

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
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <h2>AI로 새 스킬 만들기</h2>
          <Styled.AiDraftBox>
            <Field>
              <label>이 스킬이 반복해서 어떤 일을 잘했으면 하나요?</label>
              <TextArea
                rows={3}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  if (isSubmitKey(event, "modifier-enter") && brief.trim() && !draft.isPending) {
                    event.preventDefault();
                    draft.mutate();
                  }
                }}
                placeholder="예: Figma 링크를 받으면 간격과 타이포그래피를 검토하고 개선안을 정리해 줘"
              />
            </Field>
            <Styled.Suggestions>
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
          <Field>
            <label>이름</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: React 컴포넌트 제작"
              required
            />
          </Field>
          <Field>
            <label>카테고리</label>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>개발</option>
              <option>디자인</option>
              <option>조사</option>
              <option>문서</option>
              <option>운영</option>
              <option>기타</option>
            </Select>
          </Field>
          <Field>
            <label>설명</label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="언제 사용하는 스킬인가요?"
              required
            />
          </Field>
          <Field>
            <label>지시문</label>
            <TextArea
              rows={7}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="에이전트가 따라야 할 구체적인 절차를 적어 주세요."
              required
            />
          </Field>
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
            <Panel>
              <Empty>첫 번째 스킬을 만들어 보세요.</Empty>
            </Panel>
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
    <Styled.Card>
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
