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
};

export function TaskComposer({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<NonNullable<Task["priority"]>>("medium");
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
        <Button $variant="primary" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? "만드는 중..." : "작업 만들기"}
        </Button>
      </Styled.DialogActions>
      {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
    </Styled.Composer>
  );
}
