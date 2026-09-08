import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, Input, Panel, TextArea, mediaQuery } from "@ai-pixel-office/design-system";
import type { Agent, AgentModel, Project, Task, Workspace } from "@ai-pixel-office/domain/entities";
import { PETS } from "@ai-pixel-office/pet";
import type { SystemStatus } from "../system/api.ts";
import { systemApi } from "../system/api.ts";
import { agentApi } from "../agents/api.ts";
import { projectApi } from "../projects/api.ts";
import { taskApi } from "../tasks/api.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { rememberProject } from "../../shared/lib/recentProject.ts";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { OfficeSidebar } from "../../shared/ui/OfficeSidebar.tsx";
import { ConnectionCard } from "../system/components/ConnectionCard.tsx";
import { EmployeeBadge } from "../agents/components/EmployeeBadge.tsx";
import { PetPreview } from "../office/PetPreview.tsx";
import { PixelWorkLoader } from "../../shared/ui/PixelWorkLoader.tsx";
import { SegmentedControl } from "../../shared/ui/SegmentedControl.tsx";

type StepId = "intent" | "colleague" | "runtime" | "project" | "creation";
const STEP_LABELS: Record<StepId, string> = {
  intent: "업무 요청",
  colleague: "동료 준비",
  runtime: "AI 연결",
  project: "작업 폴더",
  creation: "첫 업무 시작",
};
const Page = styled.main`
  min-height: 100dvh;
  padding: ${({ theme }) => theme.space.x6};
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.colors.background.canvas};
  @media ${mediaQuery.md} {
    padding: 0;
    place-items: stretch;
  }
`;
const Shell = styled.div`
  width: min(1040px, 100%);
  height: min(720px, calc(100dvh - ${({ theme }) => theme.space.x6} * 2));
  min-height: 600px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 228px minmax(0, 1fr);
  overflow: hidden;
  @media ${mediaQuery.md} {
    width: 100%;
    height: auto;
    min-height: 100dvh;
    overflow: visible;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;
const Content = styled.div`
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
`;
const OnboardingTitle = styled.header`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  color: ${({ theme }) => theme.colors.text.inverse};
  span {
    color: ${({ theme }) => theme.colors.semantic.warning};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    letter-spacing: 0.08em;
  }
  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.headingXl};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.onBrandMuted};
    line-height: 1.5;
  }
`;
const StepNav = styled.ol`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  margin: ${({ theme }) => `${theme.space.x8} 0 ${theme.space.x6}`};
  padding: 0;
  list-style: none;
  li {
    min-height: 44px;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    display: grid;
    grid-template-columns: 24px 1fr;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    border: 2px solid transparent;
    color: ${({ theme }) => theme.colors.text.inverse};
    opacity: 0.72;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  }
  li span:first-child {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    text-align: center;
    border: 1px solid currentColor;
    padding: 2px;
  }
  li[data-complete="true"] {
    color: ${({ theme }) => theme.colors.text.inverse};
    opacity: 1;
  }
  li[aria-current="step"] {
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.primary};
    border-color: ${({ theme }) => theme.colors.border.strong};
    box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
    opacity: 1;
  }
  @media ${mediaQuery.md} {
    display: flex;
    overflow-x: auto;
    margin: 0 0 0 auto;
    li {
      white-space: nowrap;
    }
  }
`;
const Card = styled(Panel).attrs({ as: "section" })`
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.space.x6};
  padding: ${({ theme }) => theme.space.x6};
  border: 0;
  box-shadow: none;
  @media ${mediaQuery.sm} {
    padding: ${({ theme }) => theme.space.x4};
    gap: ${({ theme }) => theme.space.x5};
  }
`;
const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.space.x6};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
`;
const Body = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding-right: ${({ theme }) => theme.space.x2};
  display: grid;
  align-content: start;
  gap: ${({ theme }) => theme.space.x5};
  h1,
  p {
    margin: 0;
  }
  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize.headingXl};
  }
  p {
    color: ${({ theme }) => theme.colors.text.muted};
    line-height: 1.6;
  }
  @media ${mediaQuery.md} {
    overflow-y: visible;
    padding-right: 0;
  }
`;
const Heading = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
`;
const Form = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x4};
`;
const Footer = styled.footer`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x2};
  padding-top: ${({ theme }) => theme.space.x4};
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  @media ${mediaQuery.sm} {
    button {
      flex: 1 1 100%;
    }
  }
`;
const RuntimeList = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
`;
const Folder = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x4};
  padding: ${({ theme }) => theme.space.x4};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
`;
const PetChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.space.x2};
  button {
    min-height: 88px;
    padding: ${({ theme }) => theme.space.x3};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
    border: 2px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    text-align: left;
    cursor: pointer;
  }
  button[aria-checked="true"] {
    border-color: ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.shadow.positive};
  }
  button span {
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
  }
  button small {
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;
const Recommendation = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  padding: ${({ theme }) => `${theme.space.x3} 0`};
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;
const StatusList = styled.ol`
  display: grid;
  gap: ${({ theme }) => theme.space.x3};
  margin: 0;
  padding-left: ${({ theme }) => theme.space.x5};
  li {
    color: ${({ theme }) => theme.colors.text.muted};
  }
  li[data-active="true"] {
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: 700;
  }
`;
const titleFrom = (value: string) => value.trim().split(/\r?\n/)[0]!.slice(0, 80);

type OnboardingViewContext = {
  intent: string;
  setIntent: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  model?: AgentModel;
  availableModels: AgentModel[];
  setModel: (value: AgentModel) => void;
  rationale: string;
  petRationale: string;
  recommendedPetIds: string[];
  avatarId: string;
  setAvatarId: (value: string) => void;
  needsProject: boolean;
  setNeedsProject: (value: boolean) => void;
  projectPath: string;
  projectName: string;
  projectGoal: string;
  setProjectName: (value: string) => void;
  setProjectGoal: (value: string) => void;
  status: SystemStatus;
  onRefresh: () => Promise<unknown>;
  pickFolder: () => void;
  pickFolderError: unknown;
  creationStage: number;
  launchError: unknown;
  fitError: unknown;
};
const OnboardingContext = createContext<OnboardingViewContext | null>(null);
const useOnboarding = () => {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("Onboarding step must be rendered inside OnboardingContext");
  return value;
};

function IntentStep() {
  const { intent, setIntent } = useOnboarding();
  return (
    <>
      <Heading>
        <h1 id="intent-title">가장 먼저 어떤 일을 맡길까요?</h1>
        <p>지금 떠오르는 실제 업무를 적어 주세요. 이 내용이 첫 Task로 그대로 이어져요.</p>
      </Heading>
      <Field>
        <label htmlFor="first-intent">첫 업무</label>
        <TextArea
          id="first-intent"
          autoFocus
          rows={7}
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          placeholder="예: 이번 주 회의 자료를 읽고 핵심 결정 사항을 정리해 줘"
        />
      </Field>
    </>
  );
}
function ColleagueStep() {
  const {
    name,
    setName,
    role,
    setRole,
    model,
    rationale,
    petRationale,
    recommendedPetIds,
    avatarId,
    setAvatarId,
  } = useOnboarding();
  return (
    <>
      <Heading>
        <h1 id="colleague-title">새 동료의 출근을 준비해요</h1>
        <p>선택한 AI가 첫 업무에 맞는 동료 구성과 Pet을 제안했어요.</p>
      </Heading>
      <EmployeeBadge
        petId={avatarId}
        name={name}
        role={role}
        meta={`${model === "codex" ? "Codex" : "Claude"} · 출근 준비 중`}
      />
      <Recommendation>
        <strong>이렇게 제안했어요</strong>
        <span>{rationale}</span>
      </Recommendation>
      <Form>
        <Field>
          <label htmlFor="colleague-name">사원증 이름</label>
          <Input
            id="colleague-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <label>함께 출근할 Pet</label>
          <small>{petRationale}</small>
          <PetChoices role="radiogroup" aria-label="추천 Pet 선택">
            {recommendedPetIds.map((petId) => {
              const pet = PETS.find((item) => item.id === petId);
              if (!pet) return null;
              return (
                <button
                  key={pet.id}
                  type="button"
                  role="radio"
                  aria-checked={avatarId === pet.id}
                  onClick={() => setAvatarId(pet.id)}
                >
                  <PetPreview petId={pet.id} size={56} />
                  <span>
                    <strong>{pet.name}</strong>
                    <small>
                      {pet.species === "dog" ? "강아지" : "고양이"} · {pet.breed}
                    </small>
                  </span>
                </button>
              );
            })}
          </PetChoices>
        </Field>
        <Field>
          <label htmlFor="colleague-role">맡을 일</label>
          <TextArea
            id="colleague-role"
            rows={4}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
        </Field>
      </Form>
    </>
  );
}
function RuntimeStep() {
  const { status, onRefresh, model, availableModels, setModel, fitError } = useOnboarding();
  return (
    <>
      <Heading>
        <h1 id="runtime-title">이 업무를 맡을 AI를 연결해요</h1>
        <p>
          이 동료가 실제 업무에 사용할 AI를 선택해 주세요. 선택한 AI가 동료 구성과 Pet도 함께
          제안합니다.
        </p>
      </Heading>
      <RuntimeList>
        {(["codex", "claude"] as const).map((runtime) => (
          <ConnectionCard
            key={runtime}
            name={runtime === "codex" ? "Codex" : "Claude"}
            installed={status[runtime].installed}
            connected={status[runtime].authenticated}
            detail={status[runtime].detail}
            version={status[runtime].version}
            command={runtime === "codex" ? "codex login" : "claude auth login"}
            runtime={runtime}
            onStatusRefresh={() => void onRefresh()}
            showDeveloperOptions={false}
          />
        ))}
      </RuntimeList>
      {availableModels.length > 1 && (
        <Field>
          <label>이 동료가 사용할 AI</label>
          <SegmentedControl role="radiogroup" aria-label="이번 동료가 사용할 AI">
            {availableModels.map((runtime) => (
              <button
                key={runtime}
                type="button"
                role="radio"
                aria-checked={model === runtime}
                onClick={() => setModel(runtime)}
              >
                {runtime === "codex" ? "Codex" : "Claude"}
              </button>
            ))}
          </SegmentedControl>
        </Field>
      )}
      {fitError ? <ErrorBanner>{messageOf(fitError)}</ErrorBanner> : null}
    </>
  );
}
function ProjectStep() {
  const {
    projectPath,
    projectName,
    setProjectName,
    projectGoal,
    setProjectGoal,
    pickFolder,
    pickFolderError,
  } = useOnboarding();
  return (
    <>
      <Heading>
        <h1 id="project-title">프로젝트와 함께 시작할까요?</h1>
        <p>
          프로젝트 폴더를 연결하면 새 동료가 관련 코드와 문서를 읽고, 첫 업무를 더 정확한 맥락에서
          시작할 수 있어요.
        </p>
      </Heading>
      <Folder>
        <strong>프로젝트 폴더 · 선택</strong>
        {projectPath ? (
          <Input value={projectPath} readOnly />
        ) : (
          <p>필요한 폴더가 없다면 선택하지 않고 다음으로 넘어가세요.</p>
        )}
        <Button type="button" $variant="secondary" onClick={pickFolder}>
          {projectPath ? "다른 폴더 선택" : "폴더 선택"}
        </Button>
      </Folder>
      {projectPath && (
        <Form>
          <Field>
            <label htmlFor="project-name">프로젝트 이름</label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </Field>
          <Field>
            <label htmlFor="project-goal">프로젝트 목표 · 선택</label>
            <TextArea
              id="project-goal"
              rows={3}
              value={projectGoal}
              onChange={(event) => setProjectGoal(event.target.value)}
            />
          </Field>
        </Form>
      )}
      {pickFolderError ? <ErrorBanner>{messageOf(pickFolderError)}</ErrorBanner> : null}
    </>
  );
}
function CreationStep() {
  const { creationStage, needsProject, launchError } = useOnboarding();
  return (
    <>
      <Heading>
        <h1 id="creation-title">첫 업무를 준비하고 있어요</h1>
        <p aria-live="polite">완료되면 바로 기존 Task 화면에서 실행 상태를 보여드릴게요.</p>
      </Heading>
      <StatusList>
        <li data-active={creationStage === 0}>AI 동료 만들기</li>
        {needsProject && <li data-active={creationStage === 1}>프로젝트 연결하기</li>}
        <li data-active={creationStage === 2}>첫 Task 시작하기</li>
      </StatusList>
      {launchError ? <ErrorBanner>{messageOf(launchError)}</ErrorBanner> : null}
    </>
  );
}
function StepContent({ step }: { step: StepId }) {
  if (step === "intent") return <IntentStep />;
  if (step === "colleague") return <ColleagueStep />;
  if (step === "runtime") return <RuntimeStep />;
  if (step === "project") return <ProjectStep />;
  return <CreationStep />;
}

export function OnboardingFlow({
  workspace,
  status,
  onComplete,
  onSkip,
  onRefresh,
}: {
  workspace: Workspace;
  status: SystemStatus;
  agents: Awaited<ReturnType<typeof agentApi.list>>;
  onComplete: (taskId?: string) => void;
  onSkip: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const draftKey = `pixel-office:onboarding-draft:${workspace.id}`;
  const restored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [draftKey]);
  const [step, setStep] = useState<StepId>("intent");
  const [intent, setIntent] = useState(typeof restored.intent === "string" ? restored.intent : "");
  const [name, setName] = useState(
    typeof restored.name === "string" ? restored.name : "업무 도우미",
  );
  const [role, setRole] = useState(typeof restored.role === "string" ? restored.role : "");
  const [rationale, setRationale] = useState(
    typeof restored.rationale === "string" ? restored.rationale : "",
  );
  const [petRationale, setPetRationale] = useState(
    typeof restored.petRationale === "string" ? restored.petRationale : "",
  );
  const [recommendedPetIds, setRecommendedPetIds] = useState<string[]>(
    Array.isArray(restored.recommendedPetIds)
      ? restored.recommendedPetIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  const [avatarId, setAvatarId] = useState(
    typeof restored.avatarId === "string" ? restored.avatarId : PETS[0]!.id,
  );
  const [needsProject, setNeedsProject] = useState(restored.needsProject === true);
  const [projectPath, setProjectPath] = useState(
    typeof restored.projectPath === "string" ? restored.projectPath : "",
  );
  const [projectName, setProjectName] = useState(
    typeof restored.projectName === "string" ? restored.projectName : "",
  );
  const [projectGoal, setProjectGoal] = useState(
    typeof restored.projectGoal === "string" ? restored.projectGoal : "",
  );
  const [creationStage, setCreationStage] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const createdAgent = useRef<Agent | undefined>(undefined);
  const createdProject = useRef<Project | undefined>(undefined);
  const createdTask = useRef<Task | undefined>(undefined);
  const authenticated = (["codex", "claude"] as const).filter(
    (runtime) => status[runtime].authenticated,
  );
  const [model, setModel] = useState<AgentModel | undefined>(() =>
    authenticated.length === 1 ? authenticated[0] : undefined,
  );
  useEffect(() => {
    if (authenticated.length === 1) setModel(authenticated[0]);
    else if (model && !authenticated.includes(model)) setModel(undefined);
  }, [authenticated, model]);
  const steps = useMemo<StepId[]>(
    () => ["intent", "runtime", "colleague", "project", "creation"],
    [],
  );
  const index = Math.max(0, steps.indexOf(step));
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          intent,
          name,
          role,
          rationale,
          petRationale,
          recommendedPetIds,
          avatarId,
          needsProject,
          projectPath,
          projectName,
          projectGoal,
        }),
      );
    } catch {
      /* session state remains */
    }
  }, [
    draftKey,
    intent,
    name,
    role,
    rationale,
    petRationale,
    recommendedPetIds,
    avatarId,
    needsProject,
    projectPath,
    projectName,
    projectGoal,
  ]);
  useEffect(() => {
    bodyRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const pickFolder = useMutation({
    mutationFn: () => systemApi.pickDirectory(projectPath || undefined),
    onSuccess: (result) => {
      if (!result.path) return;
      setProjectPath(result.path);
      setNeedsProject(true);
      setProjectName(
        result.path
          .replace(/[\\/]+$/, "")
          .split(/[\\/]/)
          .pop() ?? result.path,
      );
    },
  });
  const fit = useMutation({
    mutationFn: () => {
      if (!model) throw new Error("동료가 사용할 AI를 먼저 연결하거나 선택해 주세요.");
      return agentApi.previewFit({ intent: intent.trim(), runtime: model });
    },
    onSuccess: (result) => {
      setName(result.name);
      setRole(result.role);
      setRationale(result.rationale);
      setPetRationale(result.petRationale);
      setRecommendedPetIds(result.petIds);
      setAvatarId(result.petIds[0] ?? PETS[0]!.id);
      setStep("colleague");
    },
  });
  const launch = useMutation({
    mutationFn: async () => {
      if (!model) throw new Error("연결된 AI가 없습니다. 이전 단계에서 연결을 확인해 주세요.");
      setCreationStage(0);
      const agent =
        createdAgent.current ??
        (await agentApi.create({
          workspaceId: workspace.id,
          name: name.trim(),
          role: role.trim(),
          model,
          mode: "worker",
          avatarId,
          skillIds: [],
          permissions: { fileRead: true, fileWrite: true, terminal: true },
        }));
      createdAgent.current = agent;
      let project = createdProject.current;
      if (needsProject && !project) {
        setCreationStage(1);
        project = await projectApi.create({
          workspaceId: workspace.id,
          name: projectName.trim(),
          path: projectPath,
          description: projectGoal.trim() || undefined,
        });
        createdProject.current = project;
        rememberProject(workspace.id, project.id);
      }
      setCreationStage(2);
      const task =
        createdTask.current ??
        (await taskApi.create({
          workspaceId: workspace.id,
          title: titleFrom(intent),
          description: intent.trim(),
          assigneeAgentId: agent.id,
          projectId: project?.id,
          origin: "office",
        }));
      createdTask.current = task;
      await taskApi.run(task.id);
      return task;
    },
    onSuccess: async (task) => {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* completion is independent */
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] }),
      ]);
      onComplete(task.id);
    },
  });
  useEffect(() => {
    if (step === "creation" && !launch.isPending && !launch.isError && !launch.isSuccess)
      launch.mutate();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const afterColleague = () => setStep("project");
  const back = () =>
    setStep(step === "runtime" ? "intent" : step === "colleague" ? "runtime" : "colleague");
  const contextValue: OnboardingViewContext = {
    intent,
    setIntent,
    name,
    setName,
    role,
    setRole,
    model,
    availableModels: [...authenticated],
    setModel,
    rationale,
    petRationale,
    recommendedPetIds,
    avatarId,
    setAvatarId,
    needsProject,
    setNeedsProject,
    projectPath,
    projectName,
    projectGoal,
    setProjectName,
    setProjectGoal,
    status,
    onRefresh,
    pickFolder: () => pickFolder.mutate(),
    pickFolderError: pickFolder.error,
    creationStage,
    launchError: launch.error,
    fitError: fit.error,
  };

  return (
    <Page>
      <Shell>
        <OfficeSidebar embedded>
          <OnboardingTitle>
            <span>NEW WORKDAY</span>
            <strong>출근 준비</strong>
            <p>첫 동료와 시작할 업무를 차근차근 준비해요.</p>
          </OnboardingTitle>
          <StepNav aria-label="첫 업무 준비 단계">
            {steps.map((id, i) => (
              <li
                key={id}
                aria-current={i === index ? "step" : undefined}
                data-complete={i < index}
              >
                <span aria-hidden="true">{i < index ? "✓" : String(i + 1).padStart(2, "0")}</span>
                <span>{STEP_LABELS[id]}</span>
              </li>
            ))}
          </StepNav>
        </OfficeSidebar>
        <Content>
          <OnboardingContext.Provider value={contextValue}>
            <Card aria-labelledby={`${step}-title`}>
              {fit.isPending && (
                <LoadingOverlay>
                  <PixelWorkLoader
                    title="새 동료를 찾고 있어요"
                    description={`${model === "codex" ? "Codex" : "Claude"}가 첫 업무를 읽고 어울리는 역할과 Pet을 준비하고 있습니다.`}
                  />
                </LoadingOverlay>
              )}
              <Body ref={bodyRef}>
                <StepContent step={step} />
              </Body>
              <Footer>
                {step !== "intent" && step !== "creation" && (
                  <Button type="button" $variant="secondary" onClick={back}>
                    이전
                  </Button>
                )}
                {step === "intent" && (
                  <>
                    <Button type="button" $variant="secondary" onClick={onSkip}>
                      나중에 직접 구성
                    </Button>
                    <Button
                      type="button"
                      $variant="primary"
                      disabled={!intent.trim()}
                      onClick={() => {
                        setStep("runtime");
                      }}
                    >
                      AI 연결하고 동료 찾기
                    </Button>
                  </>
                )}
                {step === "colleague" && (
                  <Button
                    type="button"
                    $variant="primary"
                    disabled={!name.trim() || !role.trim() || !model}
                    onClick={afterColleague}
                  >
                    이 동료와 시작하기
                  </Button>
                )}
                {step === "runtime" && (
                  <Button
                    type="button"
                    $variant="primary"
                    disabled={!model || fit.isPending}
                    onClick={() => fit.mutate()}
                  >
                    {fit.isPending ? "동료를 찾는 중…" : "이 AI로 동료 추천받기"}
                  </Button>
                )}
                {step === "project" && (
                  <>
                    <Button
                      type="button"
                      $variant="primary"
                      disabled={Boolean(projectPath) && !projectName.trim()}
                      onClick={() => {
                        setNeedsProject(Boolean(projectPath));
                        setStep("creation");
                      }}
                    >
                      첫 업무 시작하기
                    </Button>
                  </>
                )}
                {step === "creation" && launch.isError && (
                  <Button type="button" $variant="primary" onClick={() => launch.mutate()}>
                    실패한 단계 다시 시도
                  </Button>
                )}
              </Footer>
            </Card>
          </OnboardingContext.Provider>
        </Content>
      </Shell>
    </Page>
  );
}
