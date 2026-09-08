import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, Select } from "@ai-pixel-office/design-system";
import type { Task, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi } from "../../tasks/api.ts";
import { TaskComposerFields } from "../../tasks/components/TaskComposerFields.tsx";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { projectApi } from "../../projects/api.ts";
import { recentProjectId, rememberProject } from "../../../shared/lib/recentProject.ts";

const Styled = {
  Composer: styled.form`
    margin: 0;
    padding: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    align-items: end;
  `,
  DialogActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  ReadinessNote: styled.div`
    padding: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x2}`};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};

    div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
    }

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }

    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    @media ${({ theme }) => theme.mediaQuery.md} {
      align-items: stretch;
      flex-direction: column;
    }
  `,
};

export function TaskComposer({
  workspace,
  onDone,
  readiness,
}: {
  workspace: Workspace;
  onDone: () => void;
  readiness?: { ready: boolean; showSetupNotice: boolean; onResumeOnboarding: () => void };
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // 설정 해결을 위해 composer가 unmount되어도 같은 앱 세션의 작성 내용 보존
  const draftKey = `task-composer-draft:${workspace.id}`;
  const savedDraft = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey) ?? "null") as {
        title?: string;
        description?: string;
        priority?: NonNullable<Task["priority"]>;
      } | null;
    } catch {
      return null;
    }
  })();
  const [title, setTitleState] = useState(savedDraft?.title ?? "");
  const [description, setDescriptionState] = useState(savedDraft?.description ?? "");
  const [priority, setPriorityState] = useState<NonNullable<Task["priority"]>>(
    savedDraft?.priority ?? "medium",
  );
  const saveDraft = (next: {
    title: string;
    description: string;
    priority: NonNullable<Task["priority"]>;
  }) => sessionStorage.setItem(draftKey, JSON.stringify(next));
  const setTitle = (value: string) => {
    setTitleState(value);
    saveDraft({ title: value, description, priority });
  };
  const setDescription = (value: string) => {
    setDescriptionState(value);
    saveDraft({ title, description: value, priority });
  };
  const setPriority = (value: NonNullable<Task["priority"]>) => {
    setPriorityState(value);
    saveDraft({ title, description, priority: value });
  };
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const projectsWithFolders = (projects.data ?? []).filter((project) => project.path);
  const latestProject = projectsWithFolders.reduce<
    (typeof projectsWithFolders)[number] | undefined
  >(
    (latest, project) => (!latest || project.createdAt > latest.createdAt ? project : latest),
    undefined,
  );
  const [projectId, setProjectId] = useState<string | null>(() => recentProjectId(workspace.id));
  let resolvedProjectId = projectId ?? latestProject?.id ?? "";
  if (!projectsWithFolders.some((project) => project.id === resolvedProjectId)) {
    resolvedProjectId = "";
  }
  const mutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        workspaceId: workspace.id,
        title,
        description: description || undefined,
        priority,
        projectId: resolvedProjectId || undefined,
      }),
    onSuccess: (task) => {
      sessionStorage.removeItem(draftKey);
      rememberProject(workspace.id, task.projectId);
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      onDone();
      navigate(`/tasks/${task.id}`);
    },
  });
  return (
    <Styled.Composer
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      {readiness && !readiness.ready && (
        <Styled.ReadinessNote>
          <div>
            <strong>작업을 시작하려면 출근 준비가 필요해요</strong>
            <span>작성한 내용은 현재 앱 세션 동안 보관해 둘게요</span>
          </div>
          <Button type="button" $variant="secondary" onClick={readiness.onResumeOnboarding}>
            설정 이어하기
          </Button>
        </Styled.ReadinessNote>
      )}
      <TaskComposerFields
        title={title}
        onTitleChange={setTitle}
        description={description}
        onDescriptionChange={setDescription}
        priority={priority}
        onPriorityChange={setPriority}
        autoFocusTitle
      />
      <Field>
        <label>프로젝트</label>
        <Select value={resolvedProjectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">일반 작업 공간</option>
          {projectsWithFolders.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Styled.DialogActions>
        <Button
          $variant="primary"
          disabled={mutation.isPending || !title.trim() || readiness?.ready === false}
        >
          {mutation.isPending ? "만드는 중..." : "작업 만들기"}
        </Button>
      </Styled.DialogActions>
      {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
    </Styled.Composer>
  );
}
