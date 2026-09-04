# AI 개발 workflow routing

이 문서는 Codex와 Claude가 같은 역할 분류를 사용하도록 한다. 작은 단일 변경에는 별도 에이전트를
추가하지 않는다. 탐색, 구현, 시각 자산, 검증처럼 경계가 분명하고 병렬 이득이 있을 때 사용한다.

| 역할                        | 맡길 작업                                                             | 권장 수준             |
| --------------------------- | --------------------------------------------------------------------- | --------------------- |
| Product Architect           | Electron/local/community 경계, package format, 권한 모델, ADR         | 강한 추론 모델        |
| Runtime Integrator          | Codex app-server, Claude CLI, OAuth/login, approval/cancel capability | 강한 추론 모델        |
| Desktop Engineer            | Electron lifecycle, preload IPC, native module packaging, auto-update | 일반~강한 구현 모델   |
| UI/UX Engineer              | 정보 구조, styled-components 전환, 접근성, onboarding                 | 일반 구현 모델        |
| Pixel Asset Artist          | 캐릭터 방향·상태별 sprite sheet·배경 tile 제작                        | 이미지 생성/편집 모델 |
| Animation Engineer          | PixiJS state machine, sprite atlas, 성능·reduced motion               | 일반 구현 모델        |
| Community Security Reviewer | package hash, immutable install, permission gate, supply-chain review | 강한 review 모델      |
| Test/Release Engineer       | Windows/macOS installer, native ABI, smoke/e2e, upgrade 검증          | 일반~강한 검증 모델   |
| Mechanical Migrator         | import 변경, CSS selector 이관, formatting처럼 결정론적 작업          | 빠른 모델             |

에셋 역할은 bitmap 자산을 만들고 Animation Engineer가 atlas 규격과 runtime 연결을 담당하도록
나눈다. 같은 파일을 동시에 수정하는 write-heavy 위임은 피하고, 구현과 독립 검증의 소유권을
분리한다.

Subtask에는 목표, 완료 조건, 수정 가능 파일, 관련 ADR, dirty worktree, 검증 명령을 전달한다.
