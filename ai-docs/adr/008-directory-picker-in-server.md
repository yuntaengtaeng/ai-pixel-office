# ADR 008: 네이티브 폴더 선택 대화상자를 Electron이 아니라 server에 둔다

## 상태

Accepted — 2026-09-05

## 맥락

`apps/server/src/directory-picker.ts`의 `pickDirectory()`는 플랫폼별 네이티브 폴더 선택 대화상자를
직접 spawn한다 — Windows는 PowerShell의 `System.Windows.Forms.FolderBrowserDialog`, macOS는
`osascript`의 `choose folder`, Linux는 `zenity --file-selection --directory`. `/api/system/pick-directory`
엔드포인트가 이 함수를 호출하고, web은 `systemApi.pickDirectory()`로 HTTP 호출만 한다.

`agent-guidelines.md`의 안정적인 원칙은 "Electron main process가... SQLite 경로와 OS integration을
소유한다. Fastify server를 Electron main bundle에 포함하지 않는다"이다. 네이티브 GUI 대화상자를 띄우는
것은 전형적인 OS integration이라, 엄밀히 보면 지금 구조는 이 원칙과 어긋난다. Electron은 정확히 이 용도의
`dialog.showOpenDialog()` API를 제공하며, `apps/desktop/src/main.ts`는 현재 `dialog.showErrorBox`(시작
실패 알림)만 쓰고 이 기능을 위한 IPC bridge는 없다.

그런데 `architecture.md`가 정의한 두 실행 모드 중 "Browser development"(Vite renderer -> local Fastify
-> Claude/Codex CLI)에는 Electron 자체가 없다. 순수 브라우저 렌더러는 절대 경로를 반환하는 네이티브 폴더
선택창을 열 방법이 없다(`<input type="file" webkitdirectory">`는 샌드박스 때문에 절대 경로를 주지
않는다). 이 기능을 Electron으로 옮기면:

- 설치형 desktop 모드: preload IPC bridge로 열기
- browser-dev 모드: 여전히 서버 호출(Electron이 없으므로 대안이 없음)

즉 web 쪽에 실행 모드에 따라 갈라지는 두 코드 경로가 생기고, 이는 "Web renderer는 Node API에 직접
접근하지 않고 HTTP 또는 좁은 preload bridge를 사용한다"는 다른 원칙이 기대하는 단일 경로 통신과
충돌한다.

## 결정

`pickDirectory()`는 `apps/server`에 남긴다. 이는 "OS integration은 Electron이 소유한다" 원칙의 의도적인
예외이며, 예외 사유는 다음으로 한정한다.

- 이 기능은 browser-dev 모드에서도 동작해야 하고, 그 모드에는 애초에 Electron이 없다.
- server에 두면 desktop/browser-dev 두 실행 모드에서 web이 완전히 같은 HTTP 경로 하나만 쓴다.
- 네이티브 대화상자는 `execFile`로 별도 프로세스를 짧게 띄우고 결과(경로 또는 취소)만 받는
  요청-응답형 상호작용이라, Electron main과 지속적으로 연결돼 있어야 하는 다른 OS 상태(SQLite
  경로, child process 수명주기)와 성격이 다르다.

이 예외는 "폴더 선택"이라는 좁은 기능에만 적용되고, 다른 OS integration(SQLite 경로 소유, Claude/Codex
CLI child process 수명주기, 알림, 트레이 아이콘 등)은 여전히 Electron main이 소유한다는 기존 원칙을
바꾸지 않는다.

## 결과

- server 프로세스가 `powershell.exe`/`osascript`/`zenity`를 실행할 권한과 해당 바이너리의 존재를
  전제한다. 이 바이너리가 없는 환경(예: 최소 Linux 배포판에 `zenity` 미설치)에서는
  `DIRECTORY_PICKER_FAILED`로 실패하고 사용자가 경로를 직접 입력하는 폴백으로 이어진다(이미
  구현됨).
- desktop 설치본에서도 이 기능만은 Electron IPC가 아니라 loopback HTTP를 한 번 더 거친다 — 다른
  API 호출과 동일한 경로라 특별한 예외 처리는 필요 없다.

## 재검토 조건

- browser-dev 모드가 폐기되고 항상 Electron 위에서만 실행하는 구조로 바뀌면, 이 기능을 Electron
  `dialog.showOpenDialog()` + preload bridge로 옮기는 쪽이 더 단순해지므로 재검토한다.
- 알림, 트레이 아이콘, 드래그 앤 드롭처럼 이 기능과 같은 종류의 긴장(OS integration이지만
  browser-dev에서도 동작해야 함)을 가진 기능이 더 늘어나면, 그때는 개별 예외로 두지 않고 "OS 브리지"를
  desktop과 server 양쪽에 일관되게 제공하는 방식을 별도로 설계한다.
