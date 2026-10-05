---
name: interaction-state-spec
description: 기능의 loading, empty, success, error, approval, cancel, retry 등 사용자에게 보이는 상태와 전이를 정의할 때 사용한다.
---

# Interaction State Spec

정상 경로뿐 아니라 시작, 진행, 빈 결과, 실패, 중단, 재시도와 복구를 검토한다. 각 상태에서 사용자가 알 수
있는 정보와 가능한 다음 행동을 정의한다. backend capability를 추측해 존재하지 않는 상태 전이를 만들지
않고 미확인 항목은 질문으로 남긴다.
