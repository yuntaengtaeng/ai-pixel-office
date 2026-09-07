---
name: monorepo-boundaries
description: AI Pixel Office의 web, server, desktop, domain, runtime-protocol과 design-system 사이 의존 방향이 바뀌는 구현이나 리뷰에 사용한다.
---

# Monorepo Boundaries

작업 프로젝트의 `ai-docs/architecture.md`를 현재 원본으로 읽는다. `domain`과 `runtime-protocol`에
framework 의존성을 넣지 않고 desktop에서 server 구현을 코드 dependency로 import하지 않는다. renderer는
server나 Electron module에 직접 의존하지 않는다. shared package는 실제 독립 계약이나 두 번째 소비자가
생길 때만 만든다.
