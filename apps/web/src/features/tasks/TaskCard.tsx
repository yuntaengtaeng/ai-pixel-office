import { Link } from "react-router-dom";
import type { Agent, Task } from "../../../../../packages/domain/src/entities.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { PetPreview } from "../office/PetPreview.tsx";

export function TaskCard({
  task,
  agent,
  onDelete,
  deleting = false,
}: {
  task: Task;
  agent?: Agent;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <article className="task-card-row">
      <Link to={`/tasks/${task.id}`} className="task-card">
        <span className="priority" data-priority={task.priority ?? "medium"} />
        <div className="task-copy">
          <strong>{task.title}</strong>
          <span>{task.description || "설명이 없습니다."}</span>
          <small>
            {task.priority === "high" ? "높은 우선순위 · " : ""}
            {relativeTime(task.updatedAt)} 업데이트
          </small>
        </div>
        {agent ? (
          <div className="mini-agent">
            <PetPreview petId={agent.avatarId ?? ""} size={36} />
            <span>{agent.name}</span>
          </div>
        ) : (
          <span className="unassigned">배치하기 →</span>
        )}
      </Link>
      {onDelete && (
        <button
          type="button"
          className="task-delete-button"
          disabled={deleting}
          onClick={onDelete}
          aria-label={`${task.title} 삭제`}
          title="할 일 삭제"
        >
          {deleting ? (
            <span className="task-delete-loading">…</span>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5V3h8v2h4v2h-1l-1 14H6L5 7H4V5h4Zm2 0h4V4h-4v1ZM7 7l.86 12h8.28L17 7H7Zm3 2h2v8h-2V9Zm4 0h2v8h-2V9Z" />
            </svg>
          )}
        </button>
      )}
    </article>
  );
}
