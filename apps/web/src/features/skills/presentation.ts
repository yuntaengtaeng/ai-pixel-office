export function localizeSkillCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (["engineering", "frontend", "backend", "development", "code", "개발"].includes(normalized))
    return "개발";
  if (["design", "ui", "ux", "디자인"].includes(normalized)) return "디자인";
  if (["research", "analysis", "조사"].includes(normalized)) return "조사";
  if (["documentation", "writing", "docs", "문서"].includes(normalized)) return "문서";
  if (["operations", "operation", "ops", "운영"].includes(normalized)) return "운영";
  return ["기타", "개발", "디자인", "조사", "문서", "운영"].includes(category) ? category : "기타";
}
