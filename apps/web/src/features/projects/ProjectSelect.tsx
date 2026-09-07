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
  /** 폴더 미연결 프로젝트는 재배정 후보에서 제외하되, 이미 배정된 값은 목록에서 사라지지 않게 유지 */
  const options = (projects.data ?? []).filter(
    (project) => project.path || project.id === value,
  );
  return (
    <Field>
      <label>프로젝트</label>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">프로젝트 없음</option>
        {options.map((project) => (
          <option value={project.id} key={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
