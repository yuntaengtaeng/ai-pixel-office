import type { KnowledgeDocument } from "@ai-pixel-office/domain/entities";

/** 내보낼 Markdown 파일 내용 (frontmatter에 문서와 기안서 연결을 남김) */
export function markdownOf(document: KnowledgeDocument): string {
  return `---\nid: ${JSON.stringify(document.id)}\ntitle: ${JSON.stringify(document.title)}\nworkspaceId: ${JSON.stringify(document.workspaceId)}${document.taskId ? `\ntaskId: ${JSON.stringify(document.taskId)}` : ""}${document.runId ? `\nrunId: ${JSON.stringify(document.runId)}` : ""}\nreferenceTaskIds: ${JSON.stringify(document.referenceTaskIds)}\ncreatedAt: ${JSON.stringify(document.createdAt)}\nupdatedAt: ${JSON.stringify(document.updatedAt)}\n---\n\n${document.content}\n`;
}
