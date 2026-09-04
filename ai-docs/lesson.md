# 작업 교훈

이 문서는 실제 작업 중 잘못된 판단이나 반복 비용이 발생한 사례를 다음 작업자가 재현하지 않도록
기록한다. 현재 구조의 정답은 `architecture.md`와 ADR이 소유하며, 여기서는 판단 과정과 검증 순서를
다룬다.

## 2026-09-04 — Electron/Fastify process boundary

### 아쉬웠던 점

1. 사용자의 성공 기준은 `pnpm run dev` 한 번으로 API, Web, Electron 창이 모두 뜨는 것이었는데,
   초기에 package build 검증을 먼저 제안했다. 생성 번들 오류를 확인할 필요는 있었지만 dev 성공을
   먼저 증명했어야 했다.
2. `node:sqlite` import 오류를 처음에는 개별 번들 변환 문제로만 보고 우회했다. 이어서
   `@fastify/static`의 `require("path")`가 실패한 뒤에야 Fastify 전체를 Electron ESM main에 넣은
   process boundary가 근본 원인임을 확정했다. 첫 오류에서 main bundle의 크기와 포함 dependency를
   검사했으면 반복을 줄일 수 있었다.
3. 실행 중이거나 파일 핸들이 남은 Electron 설치 위에서 `pnpm install --force`를 시도했다. Windows가
   Electron 파일을 잠근 상태에서 설치가 중단되며 `checksums.json`, CLI와 runtime 일부가 빠진
   불완전한 `node_modules`가 만들어졌다. 생성 dependency 복구가 실제 구조 변경보다 더 오래 걸렸다.
4. sandbox의 esbuild 접근 오류와 프로젝트 코드 오류를 분리해 설명하는 시점이 늦었다. 같은 명령의
   실패라도 filesystem 권한, package 설치, source compile, runtime launch를 각각 구분해야 한다.

### 다음 작업의 원칙

- 사용자가 말한 가장 짧은 성공 경로를 첫 acceptance test로 둔다. 이 프로젝트의 desktop 변경은
  `pnpm run dev`로 API health, Web 응답, Electron window handle까지 확인한 뒤 production build를
  검증한다.
- Electron main에는 window lifecycle, OS integration과 child process 관리만 둔다. Fastify처럼
  CommonJS dependency graph가 큰 서비스는 별도 실행 파일로 빌드하고 main ESM bundle에 포함하지
  않는다.
- 첫 module-resolution 오류에서 임시 alias나 import 우회를 추가하기 전에 build artifact를 검색한다.
  Electron main에 `fastify`, `@fastify/static`, server repository 코드가 포함됐다면 경계가 잘못된 것이다.
- `node_modules`를 다시 구성하기 전 관련 dev process와 파일 잠금을 먼저 확인한다. 실행 중인 Electron이
  있으면 종료하고, lockfile만 바꿀 때는 `pnpm install --lockfile-only`를 우선한다. `--force`는 생성
  폴더 전체를 교체해야 하는 근거와 중단 없는 실행 환경이 있을 때만 사용한다.
- package manager가 `node_modules`를 변경하는 동안 명령을 중단하지 않는다. 불가피하게 중단됐다면
  source 오류를 디버깅하기 전에 package completeness부터 확인한다.
- 검증 순서는 다음을 기본으로 한다.

```text
pnpm run dev acceptance
  -> typecheck와 test
  -> build artifact boundary 검사
  -> build:desktop
  -> release 작업일 때만 package:desktop
```

### 유지해야 할 회귀 조건

- 개발 모드에서 server, Vite, Electron은 독립 process로 표시되어야 한다.
- `apps/desktop/dist/main.js`는 Fastify나 server 구현을 포함하지 않아야 한다.
- production `server.cjs`는 Electron main과 별도로 실행되고 ready/shutdown 메시지 계약을 지켜야 한다.
- Electron 종료 시 child server가 함께 종료되어야 한다.
