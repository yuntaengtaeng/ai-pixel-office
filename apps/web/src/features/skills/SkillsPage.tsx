import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Skill, Workspace } from "../../../../../packages/domain/src/entities.ts";
import { skillApi } from "./api.ts";
import { localizeSkillCategory } from "./presentation.ts";
import { PERMISSIONS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, PageHeader } from "../../shared/ui/common.tsx";

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
    <>
      <PageHeader eyebrow="CAPABILITY LIBRARY" title="스킬 작업실" />
      <div className="skills-layout">
        <form
          className="panel builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <h2>AI로 새 스킬 만들기</h2>
          <div className="ai-draft-box">
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
            <div className="prompt-suggestions skill-suggestions">
              {[
                "Figma 화면의 사용성과 일관성을 검토해 줘",
                "React 화면에서 재사용할 컴포넌트를 찾아 분리해 줘",
                "회의 내용을 결정 사항과 할 일로 정리해 줘",
              ].map((example) => (
                <button type="button" key={example} onClick={() => setBrief(example)}>
                  {example}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button wide"
              disabled={!brief.trim() || draft.isPending}
              onClick={() => draft.mutate()}
            >
              {draft.isPending ? "AI가 초안을 만드는 중..." : "✦ AI로 초안 만들기"}
            </button>
            {draft.isError && <ErrorBanner>{messageOf(draft.error)}</ErrorBanner>}
          </div>
          <span className="form-divider">AI 초안을 확인하고 필요하면 수정하세요</span>
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
            <div className="generated-settings">
              <label>AI가 제안한 연결</label>
              <div>
                {tools.map((tool) => (
                  <span key={tool}>도구 · {tool}</span>
                ))}
                {requiredPermissions.map((permission) => (
                  <span key={permission}>권한 · {permission}</span>
                ))}
              </div>
            </div>
          )}
          <button className="primary-button wide" disabled={mutation.isPending}>
            스킬 저장
          </button>
          {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
        </form>
        <section className="skill-library">
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
        </section>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
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
    <article className="panel skill-card">
      <span className="skill-icon">✦</span>
      <div className="skill-card-body">
        <div className="skill-card-header">
          <small>{localizeSkillCategory(skill.category)}</small>
          <button type="button" disabled={deleting} onClick={onDelete}>
            {deleting ? "삭제 중" : "삭제"}
          </button>
        </div>
        <h3 title={skill.name}>{skill.name}</h3>
        <p title={skill.description}>{skill.description}</p>
        {bindings.length > 0 && (
          <div className="skill-bindings">
            {bindings.map((binding) => (
              <span data-kind={binding.kind} key={binding.key}>
                {binding.label}
              </span>
            ))}
          </div>
        )}
        <span className="instruction-preview">{skill.instructions}</span>
        <details className="skill-instructions">
          <summary>전체 지시문 보기</summary>
          <pre>{skill.instructions}</pre>
        </details>
      </div>
    </article>
  );
}
