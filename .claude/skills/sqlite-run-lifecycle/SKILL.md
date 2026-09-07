---
name: sqlite-run-lifecycle
description: Task와 Agent run 예약, workflow 전이, SQLite transaction 또는 event/runtime 시작 순서를 변경할 때 원자성과 실행 계약을 지키는 데 사용한다.
---

# SQLite Run Lifecycle

`ai-docs/architecture.md`의 현재 run 예약 계약을 읽는다. 실패 가능한 경로 검증과 외부 I/O는 transaction
전에 끝낸다. 동시 실행 확인, run 삽입, Task/workflow 전이와 관련 기록은 하나의 동기 transaction에서
commit한다. event publish와 runtime 시작은 commit 이후에만 수행한다.
