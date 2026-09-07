---
name: runtime-protocol-events
description: Claude 또는 Codex adapter, runtime capability와 실행 event를 변경할 때 원시 runtime 차이를 공통 protocol로 정규화하는 데 사용한다.
---

# Runtime Protocol Events

Claude와 Codex의 원시 event를 UI에 직접 노출하지 않고 `packages/runtime-protocol` 계약으로 변환한다.
런타임이 실제 지원하는 approval, cancel, resume과 usage capability를 확인하며 한 runtime의 동작을 다른
runtime에도 있다고 가정하지 않는다. 불확실한 CLI 동작은 작은 capability 실험으로 확인한다.
