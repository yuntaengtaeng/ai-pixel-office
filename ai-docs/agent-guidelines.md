# 공통 에이전트 지침

## 제품 목적

AI Pixel Office는 사용자가 Claude 또는 Codex를 실행 엔진으로 삼아 Agent와 Skill을 조합하고,
할 일을 맡기고, 진행 상태를 픽셀 오피스에서 이해하는 로컬 우선 데스크톱 제품이다. 모델 이름보다
Agent의 역할, Skill, 권한, 작업 범위를 제품 개념으로 보여준다.

Community는 일반 SNS가 아니라 검증 가능한 Agent/Skill package를 발견·설치·Fork하는 registry다.
Community에서 실행하지 않고 로컬 앱이 설치, 권한 확인, 무결성 검증과 실행을 담당한다.

## 안정적인 원칙

- Electron main process가 설치형 앱의 로컬 API child process 수명주기, SQLite 경로와 OS integration을
  소유한다. Fastify server를 Electron main bundle에 포함하지 않는다.
- Web renderer는 Node API에 직접 접근하지 않고 HTTP 또는 좁은 preload bridge를 사용한다.
- Claude/Codex 원시 이벤트를 UI에 직접 노출하지 않고 runtime protocol과 product state로 정규화한다.
- 인증, 승인, sandbox capability는 런타임별 실제 지원 여부를 확인하고 지원하지 않는 흐름을 UI로
  흉내 내지 않는다.
- Community 설치본은 immutable, local/fork package는 editable로 분리한다.
- shared package는 실제 두 번째 소비자나 독립 계약이 있을 때 만든다.
- 새 UI 스타일은 styled-components와 `@ai-pixel-office/ui` theme을 사용한다. 기존 CSS는
  마이그레이션 bridge이며 새 selector를 추가하는 위치가 아니다.

## 공통 작업 원칙

1. 변경 전 Git 상태, 관련 계획·ADR, source와 package script를 확인한다.
2. runtime/IPC/HTTP/filesystem 경계를 넘는 값은 타입만 믿지 말고 입력을 검증한다.
3. generated artifact와 lockfile은 source 또는 package manager를 통해 갱신한다.
4. 기존 사용자 변경과 무관한 파일을 보존하고 요청이 없으면 commit하지 않는다.
5. 구조 변경은 문서만으로 끝내지 않고 typecheck, test, build, package 경계로 검증한다.

## 기본 검증

변경 위험에 맞는 가장 작은 명령부터 선택한다.

```bash
pnpm run check
pnpm test
pnpm run build
pnpm run build:desktop
```

Electron 설치 파일 생성은 느리고 native dependency rebuild가 포함되므로 배포 변경이나 release
검증에서 `pnpm run package:desktop`을 실행한다.
