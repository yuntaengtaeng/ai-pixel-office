import { useQuery } from "@tanstack/react-query";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageLoading } from "../../shared/ui/PageLoading.tsx";
import { agentApi } from "../agents/api.ts";
import { DeskPanel } from "./components/DeskPanel.tsx";
import { useDeskItems } from "./hooks/useDeskItems.ts";

/** 결재함 페이지 */
export function InboxPage({ workspace }: { workspace: Workspace }) {
  const desk = useDeskItems(workspace.id);
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  return (
    <BaseLayout>
      <PageHeader eyebrow="결재함" title="내가 판단할 일" />
      {desk.isError && <ErrorBanner>결재함을 불러오지 못했어요.</ErrorBanner>}
      {desk.isPending ? (
        <PageLoading>결재함을 여는 중...</PageLoading>
      ) : (
        <DeskPanel items={desk.items} agents={agents.data ?? []} now={new Date()} />
      )}
    </BaseLayout>
  );
}
