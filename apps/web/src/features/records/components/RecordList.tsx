import { relativeTime } from "../../../shared/lib/time.ts";
import { SelectableList } from "../../../shared/ui/SelectableList.tsx";
import type { RecordGroup } from "../utils/recordGroups.ts";

/** 프로젝트별로 묶은 기록 목록 */
export function RecordList({
  groups,
  selectedId,
  onSelect,
}: {
  groups: RecordGroup[];
  selectedId?: string;
  onSelect: (documentId: string) => void;
}) {
  return (
    <SelectableList label="기록 목록">
      {groups.map((group) => (
        <SelectableList.Group key={group.key} title={group.title} count={group.documents.length}>
          {group.documents.map((document) => (
            <SelectableList.Item
              key={document.id}
              selected={document.id === selectedId}
              onSelect={() => onSelect(document.id)}
            >
              <strong>{document.title}</strong>
              <small>{relativeTime(document.updatedAt)}</small>
            </SelectableList.Item>
          ))}
        </SelectableList.Group>
      ))}
    </SelectableList>
  );
}
