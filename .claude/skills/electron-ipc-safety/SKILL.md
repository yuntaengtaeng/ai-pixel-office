---
name: electron-ipc-safety
description: Electron main, preload, renderer, child process 또는 OS 기능 경계를 변경할 때 보안 설정과 입력 검증 및 process lifecycle을 보존하는 데 사용한다.
---

# Electron IPC Safety

`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`와 좁은 preload allowlist를 유지한다.
IPC 경계의 입력은 TypeScript 타입만 믿지 않고 검증한다. Electron main은 window, OS integration과 server
child process lifecycle만 소유하며 Fastify 구현을 main bundle에 포함하지 않는다.
