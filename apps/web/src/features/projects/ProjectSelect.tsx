import { useQuery } from "@tanstack/react-query";
import { Field, Select } from "@ai-pixel-office/design-system";
import { projectApi } from "./api.ts";

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
