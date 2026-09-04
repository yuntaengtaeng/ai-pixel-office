import { useQuery } from "@tanstack/react-query";
import { Field, Select } from "@ai-pixel-office/design-system";
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
    <Field $grow={grow}>
      <label>{label}</label>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {isLegacyValue && <option value={value}>기존 프로젝트 설정</option>}
        {(projects.data ?? [])
          .filter((project) => project.path)
          .map((project) => (
            <option value={project.path} key={project.id}>
              {project.name}
            </option>
          ))}
      </Select>
    </Field>
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
    <Field>
      <label>프로젝트</label>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">프로젝트 없음</option>
        {(projects.data ?? []).map((project) => (
          <option value={project.id} key={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
