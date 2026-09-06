import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Task, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi } from "../../tasks/api.ts";
import { TaskComposerFields } from "../../tasks/components/TaskComposerFields.tsx";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";

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
  const mutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        workspaceId: workspace.id,
        title,
        description: description || undefined,
        priority,
      }),
    onSuccess: (task) => {
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
      <Styled.DialogActions>
        <Button $variant="primary" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? "만드는 중..." : "작업 만들기"}
        </Button>
      </Styled.DialogActions>
      {mutation.isError && <ErrorBanner>{messageOf(mutation.error)}</ErrorBanner>}
    </Styled.Composer>
  );
}
