---
name: verification-scope
description: AI Pixel Office 코드 변경을 완료하기 전에 위험과 사용자 성공 조건에 맞는 typecheck, test, build, desktop acceptance와 package 검증 범위를 선택할 때 사용한다.
---

# Verification Scope

사용자가 말한 가장 짧은 성공 경로를 먼저 검증한다. 관련 typecheck와 test에서 시작하되 desktop lifecycle
변경은 `pnpm run dev` acceptance와 main/server artifact 경계를 확인한다. `build:desktop`은 desktop 영향이
있을 때 실행하고 `package:desktop`은 배포 또는 installer 변경일 때만 실행한다. 실행하지 못한 검증은
성공으로 표시하지 않는다.
