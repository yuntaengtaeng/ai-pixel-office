import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgentPermissions,
  ModelPolicy,
  ReasoningEffort,
  Skill,
  Workspace,
} from "../../../../../packages/domain/src/entities.ts";
import { taskApi } from "../tasks/api.ts";
import { skillApi } from "../skills/api.ts";
import { agentApi } from "./api.ts";
import { PETS } from "../office/pets.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { PERMISSIONS, STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { toggle } from "../../shared/lib/collections.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, PageHeader } from "../../shared/ui/common.tsx";
import { ProjectDirectorySelect } from "../projects/ProjectSelect.tsx";
import { ModelPolicyFields } from "./ModelPolicyFields.tsx";
import { defaultManualModel } from "./model-options.ts";

export function AgentsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [avatarId, setAvatarId] = useState(PETS[0]!.id);
  const [model, setModel] = useState<"codex" | "claude">("codex");
  const [modelPolicy, setModelPolicy] = useState<ModelPolicy>("default");
  const [modelName, setModelName] = useState(defaultManualModel("codex"));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<AgentPermissions>({
    fileRead: true,
    fileWrite: true,
    terminal: true,
  });
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const templates = useQuery({
    queryKey: ["agent-task-templates", selectedAgentId],
    queryFn: () => agentApi.listTaskTemplates(selectedAgentId),
    enabled: Boolean(selectedAgentId),
  });
  useEffect(() => {
    if (!selectedAgentId && agents.data?.[0]) setSelectedAgentId(agents.data[0].id);
  }, [agents.data, selectedAgentId]);
  const mutation = useMutation({
    mutationFn: () =>
      agentApi.create({
        workspaceId: workspace.id,
        name,
        role,
        model,
        modelPolicy,
        modelName: modelPolicy === "manual" ? modelName : undefined,
        reasoningEffort: modelPolicy === "manual" ? reasoningEffort : undefined,
        mode: "worker",
        avatarId,
        skillIds: selectedSkills,
        permissions: { ...permissions, fileRead: true, terminal: true },
        workingDirectory: workingDirectory.trim() || undefined,
      }),
    onSuccess: (agent) => {
      setName("");
      setRole("");
      setWorkingDirectory("");
      setSelectedSkills([]);
      setPermissions({ fileRead: true, fileWrite: true, terminal: true });
      setSelectedAgentId(agent.id);
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
    },
  });
  const selectedPet = PETS.find((pet) => pet.id === avatarId)!;
  const mappedSkillPermissions = Array.from(
    new Set(
      (skills.data ?? [])
        .filter((skill) => selectedSkills.includes(skill.id))
        .flatMap((skill) => skill.requiredPermissions ?? []),
    ),
  );
  const toggleSkill = (skill: Skill) => {
    const selecting = !selectedSkills.includes(skill.id);
    setSelectedSkills(toggle(selectedSkills, skill.id));
    if (selecting)
      setPermissions((current) =>
        (skill.requiredPermissions ?? []).reduce(
          (next, permission) => ({ ...next, [permission]: true }),
          { ...current, fileRead: true, terminal: true },
        ),
      );
  };
  const selectedAgent = agents.data?.find((agent) => agent.id === selectedAgentId);
  const quickTask = useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
    }) => taskApi.create({ ...input, workspaceId: workspace.id, assigneeAgentId: selectedAgentId }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const saveTemplate = useMutation({
    mutationFn: () =>
      agentApi.createTaskTemplate(selectedAgentId, {
        title: templateTitle,
        description: templateDescription || undefined,
      }),
    onSuccess: () => {
      setTemplateTitle("");
      setTemplateDescription("");
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", selectedAgentId] });
    },
  });
  const removeTemplate = useMutation({
    mutationFn: (id: string) => agentApi.deleteTaskTemplate(selectedAgentId, id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", selectedAgentId] }),
  });
  const removeAgent = useMutation({
    mutationFn: (id: string) => agentApi.remove(id),
    onSuccess: (_result, deletedId) => {
      if (selectedAgentId === deletedId) setSelectedAgentId("");
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
    },
  });
  const recentJobs = Array.from(
    new Map(
      (tasks.data ?? [])
        .filter((task) => task.assigneeAgentId === selectedAgentId)
        .map((task) => [task.title, task]),
    ).values(),
  ).slice(0, 3);
  return (
    <>
      <PageHeader eyebrow="TEAM BUILDER" title="AI 동료 만들기" />
      <div className="builder-layout">
        <form
          className="panel builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="selected-pet">
            <PetPreview petId={avatarId} size={92} />
            <div>
              <span>{selectedPet.species === "dog" ? "DOG" : "CAT"}</span>
              <strong>{selectedPet.name}</strong>
              <small>{selectedPet.breed}</small>
            </div>
          </div>
          <div className="field">
            <label>이름</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 프론트엔드 개발자"
              required
            />
          </div>
          <div className="field">
            <label>어떤 도움을 주나요?</label>
            <textarea
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="이 동료가 도와줄 일을 적어 주세요."
              required
            />
          </div>
          <fieldset className="skill-selector">
            <legend>스킬 · 선택 사항</legend>
            <p className="helper-copy">
              스킬 없이도 기본 업무를 수행합니다. 반복해서 잘해야 할 전문 업무가 있으면 스킬을
              연결하세요.
            </p>
            <div className="check-grid">
              {(skills.data ?? []).map((skill) => (
                <label
                  className="check-chip"
                  key={skill.id}
                  title={
                    (skill.requiredPermissions ?? []).length > 0
                      ? `필요 권한: ${(skill.requiredPermissions ?? []).map((permission) => PERMISSIONS.find((item) => item.key === permission)?.label ?? permission).join(", ")}`
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleSkill(skill)}
                  />
                  <span>{skill.name}</span>
                </label>
              ))}
              {skills.data?.length === 0 && (
                <Empty>스킬 없이 바로 만들 수 있습니다. 나중에 스킬 작업실에서 추가하세요.</Empty>
              )}
            </div>
            {mappedSkillPermissions.length > 0 && (
              <div className="mapped-permissions">
                <strong>자동으로 적용될 권한</strong>
                <div>
                  {mappedSkillPermissions.map((permission) => (
                    <span key={permission}>
                      {PERMISSIONS.find((item) => item.key === permission)?.label ?? permission}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
          <details className="advanced-options">
            <summary>고급 설정 · 실행 엔진과 모델</summary>
            <div>
              <div className="field">
                <label>실행 엔진</label>
                <div className="engine-picker">
                  <button
                    type="button"
                    className={model === "codex" ? "selected" : ""}
                    onClick={() => {
                      setModel("codex");
                      setModelName(defaultManualModel("codex"));
                    }}
                  >
                    Codex <small>로컬 CLI</small>
                  </button>
                  <button
                    type="button"
                    className={model === "claude" ? "selected" : ""}
                    onClick={() => {
                      setModel("claude");
                      setModelName(defaultManualModel("claude"));
                    }}
                  >
                    Claude <small>로컬 CLI</small>
                  </button>
                </div>
              </div>
              <ModelPolicyFields
                runtime={model}
                policy={modelPolicy}
                modelName={modelName}
                reasoningEffort={reasoningEffort}
                onPolicyChange={setModelPolicy}
                onModelNameChange={setModelName}
                onReasoningEffortChange={setReasoningEffort}
              />
              <>
                <ProjectDirectorySelect
                  workspaceId={workspace.id}
                  value={workingDirectory}
                  onChange={setWorkingDirectory}
                  label="기본 실행 폴더"
                  emptyLabel="워크스페이스 기본값"
                />
                <fieldset>
                  <legend>도구 권한</legend>
                  <div className="check-grid">
                    {PERMISSIONS.map(({ key, label }) => {
                      const required = key === "fileRead" || key === "terminal";
                      return (
                        <label className="check-chip" key={key}>
                          <input
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
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            </div>
          </details>
          <button
            className="primary-button wide"
            disabled={mutation.isPending || !name.trim() || !role.trim()}
          >
            에이전트 만들기
          </button>
          {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
        </form>
        <section className="panel avatar-library">
          <div className="section-heading">
            <div>
              <span className="kicker">PET LIBRARY</span>
              <h2>캐릭터 고르기</h2>
            </div>
          </div>
          <h3>강아지</h3>
          <div className="pet-grid">
            {PETS.filter((pet) => pet.species === "dog").map((pet) => (
              <PetChoice
                key={pet.id}
                pet={pet}
                selected={avatarId === pet.id}
                onSelect={setAvatarId}
              />
            ))}
          </div>
          <h3>고양이</h3>
          <div className="pet-grid">
            {PETS.filter((pet) => pet.species === "cat").map((pet) => (
              <PetChoice
                key={pet.id}
                pet={pet}
                selected={avatarId === pet.id}
                onSelect={setAvatarId}
              />
            ))}
          </div>
        </section>
      </div>
      <section className="panel roster">
        <div className="section-heading compact">
          <h2>현재 동료</h2>
          <span>{agents.data?.length ?? 0}</span>
        </div>
        <div className="roster-grid">
          {(agents.data ?? []).map((agent) => (
            <article
              key={agent.id}
              className={`agent-card ${selectedAgentId === agent.id ? "selected" : ""}`}
            >
              <button type="button" onClick={() => setSelectedAgentId(agent.id)}>
                <PetPreview petId={agent.avatarId ?? ""} size={72} />
                <div>
                  <strong>{agent.name}</strong>
                  <span>{agent.role}</span>
                  <small>
                    {agent.model.toUpperCase()} ·{" "}
                    {agent.skillIds.length > 0 ? `스킬 ${agent.skillIds.length}개` : "기본"}
                  </small>
                </div>
              </button>
              <div className="agent-card-actions">
                <Link to={`/agents/${agent.id}`} aria-label={`${agent.name} 옵션 수정`}>
                  옵션 수정
                </Link>
                <button
                  type="button"
                  disabled={removeAgent.isPending && removeAgent.variables === agent.id}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `${agent.name} 에이전트를 삭제할까요?`,
                        description: "실행 기록이 있으면 삭제할 수 없습니다.",
                        confirmLabel: "에이전트 삭제",
                        tone: "danger",
                      })
                    )
                      removeAgent.mutate(agent.id);
                  }}
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
          {agents.data?.length === 0 && <Empty>아직 초대한 동료가 없습니다.</Empty>}
        </div>
        {removeAgent.isError && <ErrorBanner>{messageOf(removeAgent.error)}</ErrorBanner>}
      </section>
      {selectedAgent && (
        <section className="panel quick-jobs">
          <div className="section-heading">
            <div>
              <span className="kicker">QUICK ASSIGN</span>
              <h2>{selectedAgent.name}에게 바로 맡기기</h2>
            </div>
          </div>
          <p className="helper-copy">
            자주 하는 일을 등록해 두면 동료를 클릭한 뒤 한 번에 작업을 만들 수 있습니다.
          </p>
          <div className="quick-job-list">
            {(templates.data ?? []).map((template) => (
              <div className="quick-job" key={template.id}>
                <button type="button" onClick={() => quickTask.mutate(template)}>
                  <strong>{template.title}</strong>
                  <span>{template.description || "설명 없이 바로 작업 만들기"}</span>
                </button>
                <button
                  type="button"
                  className="remove-quick-job"
                  aria-label="등록 작업 삭제"
                  title="등록 작업 삭제"
                  onClick={() => removeTemplate.mutate(template.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5V3h8v2h4v2h-1l-1 14H6L5 7H4V5h4Zm2 0h4V4h-4v1ZM7 7l.86 12h8.28L17 7H7Zm3 2h2v8h-2V9Zm4 0h2v8h-2V9Z" />
                  </svg>
                </button>
              </div>
            ))}
            {templates.data?.length === 0 && (
              <Empty>등록된 작업이 없습니다. 아래에서 첫 작업을 추가해 보세요.</Empty>
            )}
          </div>
          {recentJobs.length > 0 && (
            <div className="recent-jobs">
              <strong>최근 맡긴 작업</strong>
              {recentJobs.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() =>
                    quickTask.mutate({
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                    })
                  }
                >
                  {task.title}
                </button>
              ))}
            </div>
          )}
          <form
            className="quick-job-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveTemplate.mutate();
            }}
          >
            <div className="field">
              <label>작업 이름</label>
              <input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="예: UI 검토"
                required
              />
            </div>
            <div className="field grow">
              <label>기본 요청</label>
              <input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="예: Figma 화면의 사용성과 일관성을 검토해 줘"
              />
            </div>
            <button
              className="secondary-button"
              disabled={saveTemplate.isPending || !templateTitle.trim()}
            >
              등록
            </button>
          </form>
          {(quickTask.isError || saveTemplate.isError) && (
            <ErrorBanner>{messageOf(quickTask.error ?? saveTemplate.error)}</ErrorBanner>
          )}
        </section>
      )}
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

function PetChoice({
  pet,
  selected,
  onSelect,
}: {
  pet: (typeof PETS)[number];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`pet-choice ${selected ? "selected" : ""}`}
      onClick={() => onSelect(pet.id)}
      title={`${pet.breed} · ${pet.accessories.join(", ")}`}
    >
      <PetPreview petId={pet.id} size={54} />
      <strong>{pet.name}</strong>
      <span>{pet.breed}</span>
    </button>
  );
}

export function AgentDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const agentQuery = useQuery({ queryKey: ["agent", id], queryFn: () => agentApi.get(id) });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const templates = useQuery({
    queryKey: ["agent-task-templates", id],
    queryFn: () => agentApi.listTaskTemplates(id),
    enabled: Boolean(id),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState<"codex" | "claude">("codex");
  const [modelPolicy, setModelPolicy] = useState<ModelPolicy>("default");
  const [modelName, setModelName] = useState(defaultManualModel("codex"));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [avatarId, setAvatarId] = useState(PETS[0]!.id);
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<AgentPermissions>({});
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  useEffect(() => {
    const agent = agentQuery.data;
    if (!agent) return;
    setName(agent.name);
    setRole(agent.role);
    setDescription(agent.description ?? "");
    setModel(agent.model);
    setModelPolicy(agent.modelPolicy ?? "default");
    setModelName(agent.modelName ?? defaultManualModel(agent.model));
    setReasoningEffort(agent.reasoningEffort ?? "medium");
    setAvatarId(agent.avatarId ?? PETS[0]!.id);
    setWorkingDirectory(agent.workingDirectory ?? "");
    setSelectedSkills(agent.skillIds);
    setPermissions({
      ...agent.permissions,
      fileRead: true,
      fileWrite: agent.mode === "chat" ? true : agent.permissions.fileWrite,
      terminal: true,
    });
  }, [agentQuery.data]);
  const save = useMutation({
    mutationFn: () =>
      agentApi.update(id, {
        name,
        role,
        description,
        model,
        modelPolicy,
        modelName: modelPolicy === "manual" ? modelName : "",
        reasoningEffort: modelPolicy === "manual" ? reasoningEffort : undefined,
        mode: "worker",
        avatarId,
        workingDirectory,
        skillIds: selectedSkills,
        permissions: { ...permissions, fileRead: true, terminal: true },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent", id] });
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
    },
  });
  const remove = useMutation({
    mutationFn: () => agentApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      navigate("/agents");
    },
  });
  const addTemplate = useMutation({
    mutationFn: () =>
      agentApi.createTaskTemplate(id, {
        title: templateTitle,
        description: templateDescription || undefined,
      }),
    onSuccess: () => {
      setTemplateTitle("");
      setTemplateDescription("");
      void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", id] });
    },
  });
  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) => agentApi.deleteTaskTemplate(id, templateId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agent-task-templates", id] }),
  });
  if (agentQuery.isPending) return <Empty>에이전트 정보를 불러오는 중...</Empty>;
  if (agentQuery.isError || !agentQuery.data)
    return <ErrorBanner>{messageOf(agentQuery.error)}</ErrorBanner>;
  const agentTasks = (tasks.data ?? []).filter((task) => task.assigneeAgentId === id);
  const toggleAgentSkill = (skill: Skill) => {
    const selecting = !selectedSkills.includes(skill.id);
    setSelectedSkills(toggle(selectedSkills, skill.id));
    if (selecting)
      setPermissions((current) =>
        (skill.requiredPermissions ?? []).reduce(
          (next, permission) => ({ ...next, [permission]: true }),
          { ...current, fileRead: true, terminal: true },
        ),
      );
  };
  return (
    <>
      <button className="back-button" onClick={() => navigate("/agents")}>
        ← 에이전트 목록
      </button>
      <PageHeader eyebrow="AGENT PROFILE" title={agentQuery.data.name} />
      <div className="agent-detail-grid">
        <form
          className="panel builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="selected-pet">
            <PetPreview petId={avatarId} size={92} />
            <div>
              <span>{model.toUpperCase()}</span>
              <strong>{name || "이름 없음"}</strong>
              <small>
                {selectedSkills.length > 0 ? `스킬 ${selectedSkills.length}개` : "기본 업무"}
              </small>
            </div>
          </div>
          <div className="field">
            <label>캐릭터</label>
            <select value={avatarId} onChange={(event) => setAvatarId(event.target.value)}>
              {PETS.map((pet) => (
                <option value={pet.id} key={pet.id}>
                  {pet.name} · {pet.breed}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>이름</label>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="field">
            <label>역할</label>
            <textarea value={role} onChange={(event) => setRole(event.target.value)} required />
          </div>
          <div className="field">
            <label>설명</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <fieldset className="skill-selector">
            <legend>스킬 · 선택 사항</legend>
            <p className="helper-copy">
              스킬은 선택 사항이며, 연결한 스킬에 필요한 권한은 자동으로 적용됩니다.
            </p>
            <div className="check-grid">
              {(skills.data ?? []).map((skill) => (
                <label className="check-chip" key={skill.id}>
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleAgentSkill(skill)}
                  />
                  <span>{skill.name}</span>
                </label>
              ))}
              {skills.data?.length === 0 && (
                <Empty>등록된 스킬이 없습니다. 스킬 없이도 기본 업무를 수행할 수 있습니다.</Empty>
              )}
            </div>
          </fieldset>
          <details className="advanced-options">
            <summary>고급 설정 · 실행 엔진과 모델</summary>
            <div>
              <div className="field">
                <label>실행 엔진</label>
                <div className="engine-picker">
                  <button
                    type="button"
                    className={model === "codex" ? "selected" : ""}
                    onClick={() => {
                      setModel("codex");
                      setModelName(defaultManualModel("codex"));
                    }}
                  >
                    Codex
                  </button>
                  <button
                    type="button"
                    className={model === "claude" ? "selected" : ""}
                    onClick={() => {
                      setModel("claude");
                      setModelName(defaultManualModel("claude"));
                    }}
                  >
                    Claude
                  </button>
                </div>
              </div>
              <ModelPolicyFields
                runtime={model}
                policy={modelPolicy}
                modelName={modelName}
                reasoningEffort={reasoningEffort}
                onPolicyChange={setModelPolicy}
                onModelNameChange={setModelName}
                onReasoningEffortChange={setReasoningEffort}
              />
              <>
                <ProjectDirectorySelect
                  workspaceId={workspace.id}
                  value={workingDirectory}
                  onChange={setWorkingDirectory}
                  label="기본 실행 폴더"
                  emptyLabel="워크스페이스 기본값"
                />
                <fieldset>
                  <legend>권한</legend>
                  <div className="check-grid">
                    {PERMISSIONS.map(({ key, label }) => (
                      <label className="check-chip" key={key}>
                        <input
                          type="checkbox"
                          checked={permissions[key] ?? false}
                          disabled={key === "fileRead" || key === "terminal"}
                          onChange={(event) =>
                            setPermissions({ ...permissions, [key]: event.target.checked })
                          }
                        />
                        <span>
                          {label}
                          {key === "fileRead" || key === "terminal" ? " · 자동 적용" : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            </div>
          </details>
          <button
            className="primary-button wide"
            disabled={save.isPending || !name.trim() || !role.trim()}
          >
            변경 저장
          </button>
          <button
            type="button"
            className="danger-button wide"
            disabled={remove.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: "이 에이전트를 삭제할까요?",
                  description: "실행 기록이 있으면 삭제할 수 없습니다.",
                  confirmLabel: "에이전트 삭제",
                  tone: "danger",
                })
              )
                remove.mutate();
            }}
          >
            에이전트 삭제
          </button>
          {(save.isError || remove.isError) && (
            <ErrorBanner>{messageOf(save.error ?? remove.error)}</ErrorBanner>
          )}
        </form>
        <div className="agent-detail-side">
          <section className="panel profile-stats">
            <div>
              <strong>{agentTasks.length}</strong>
              <span>전체 작업</span>
            </div>
            <div>
              <strong>{agentTasks.filter((task) => task.status === "done").length}</strong>
              <span>완료</span>
            </div>
            <div>
              <strong>{agentTasks.filter((task) => task.status === "failed").length}</strong>
              <span>실패</span>
            </div>
          </section>
          <section className="panel profile-panel">
            <div className="section-heading compact">
              <h2>자주 맡기는 작업</h2>
              <span>{templates.data?.length ?? 0}</span>
            </div>
            <div className="profile-template-list">
              {(templates.data ?? []).map((template) => (
                <div key={template.id}>
                  <div>
                    <strong>{template.title}</strong>
                    <span>{template.description || "설명 없음"}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="등록 작업 삭제"
                    title="등록 작업 삭제"
                    onClick={() => deleteTemplate.mutate(template.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5V3h8v2h4v2h-1l-1 14H6L5 7H4V5h4Zm2 0h4V4h-4v1ZM7 7l.86 12h8.28L17 7H7Zm3 2h2v8h-2V9Zm4 0h2v8h-2V9Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addTemplate.mutate();
              }}
            >
              <input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="예: UI 검토"
                required
              />
              <input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="기본 요청"
              />
              <button
                className="secondary-button"
                disabled={!templateTitle.trim() || addTemplate.isPending}
              >
                추가
              </button>
            </form>
          </section>
          <section className="panel profile-panel">
            <div className="section-heading compact">
              <h2>최근 작업</h2>
              <span>{agentTasks.length}</span>
            </div>
            <div className="profile-task-list">
              {agentTasks.slice(0, 8).map((task) => (
                <Link to={`/tasks/${task.id}`} key={task.id}>
                  <span className={`status-pill status-${task.status}`}>
                    {STATUS[task.status].label}
                  </span>
                  <strong>{task.title}</strong>
                  <time>{relativeTime(task.updatedAt)}</time>
                </Link>
              ))}
              {agentTasks.length === 0 && <Empty>아직 맡은 작업이 없습니다.</Empty>}
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
