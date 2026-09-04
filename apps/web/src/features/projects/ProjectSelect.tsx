import { useQuery } from "@tanstack/react-query";
import { projectApi } from "./api.ts";

export function ProjectDirectorySelect({
  workspaceId,
  value,
  onChange,
  label,
  emptyLabel,
  grow = false,
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  emptyLabel: string;
  grow?: boolean;
}) {
  const projects = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => projectApi.list(workspaceId),
  });
  const isLegacyValue = Boolean(
    value && !(projects.data ?? []).some((project) => project.path === value),
  );
  return (
    <div className={`field${grow ? " grow" : ""}`}>
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {isLegacyValue && <option value={value}>기존 프로젝트 설정</option>}
        {(projects.data ?? [])
          .filter((project) => project.path)
          .map((project) => (
            <option value={project.path} key={project.id}>
              {project.name}
            </option>
          ))}
      </select>
    </div>
  );
}

export function ProjectSelect({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const projects = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => projectApi.list(workspaceId),
  });
  return (
    <div className="field">
      <label>프로젝트</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">프로젝트 없음</option>
        {(projects.data ?? []).map((project) => (
          <option value={project.id} key={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
