import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { KnowledgeDocument } from "@ai-pixel-office/domain/entities";

/** 선택된 문서 id를 URL의 document 쿼리 파라미터와 항상 함께 갱신 */
export function useSelectedDocumentId(documents: KnowledgeDocument[] | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    const documentId = searchParams.get("document");
    if (documentId && documents?.some((document) => document.id === documentId)) {
      setSelectedId(documentId);
    }
  }, [documents, searchParams]);

  const select = (id: string | undefined) => {
    setSelectedId(id);
    setSearchParams(id ? { document: id } : {});
  };

  return { selectedId, select };
}
