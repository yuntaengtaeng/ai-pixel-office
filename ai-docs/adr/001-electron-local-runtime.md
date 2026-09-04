# ADR 001: Electron이 로컬 runtime을 소유한다

## 상태

Accepted — 2026-09-04

## 맥락

브라우저형 UI는 설치와 인증 흐름이 개발자 중심이고, 로컬 폴더·CLI·SQLite를 사용하면서도 사용자가
웹 서버 개념을 알아야 했다. Community는 원격 서비스가 되지만 Agent 실행과 사용자 파일은 로컬에
남아야 한다.

## 결정

Electron main process가 별도로 빌드된 Fastify server child process와 사용자 데이터 경로를
시작·종료한다. Fastify와 그 dependency는 Electron main ESM bundle에 넣지 않는다. 기존 React
renderer는 재사용하며 production에서는 local server가 정적 build도 제공한다. OS/CLI 동작은
preload의 allowlist IPC로만 노출한다.

## 결과

- 사용자는 설치한 앱 하나만 실행한다.
- 로컬 API와 renderer는 loopback same-origin으로 통신한다.
- Fastify의 CommonJS dependency와 Electron main의 ESM bundle이 서로 영향을 주지 않는다.
- 개발에서는 server, Vite, Electron이 독립 process라 실패 위치를 구분할 수 있다.
- native module은 Electron ABI에 맞춘 installer 검증이 필요하다.
- Community 인증과 로컬 runtime 인증은 별도 adapter/capability로 관리한다.

## 재검토 조건

server child process 시작 비용이나 IPC 기반 대안이 HTTP 경계보다 명확한 이점을 보이거나, 브라우저
단독 제품이 로컬 실행과 동일한 우선순위를 갖게 되면 process boundary를 재검토한다.
