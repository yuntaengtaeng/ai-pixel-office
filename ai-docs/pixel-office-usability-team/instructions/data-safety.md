# Data safety

기본값은 `simulation`과 synthetic data다. `live` 또는 `hybrid`에서 데이터를 만들 때 다음을 지킨다.

- 별도 테스트 프로젝트/폴더와 식별 가능한 `UT-` 접두사를 사용한다.
- 실제 API key, 개인 정보, 회사 기밀, production repository를 입력하지 않는다.
- 기존 사용자 데이터 수정·삭제, 외부 메시지·게시·결제, 권한 확대는 테스트 범위에 자동 포함하지 않는다.
- 생성 데이터의 경로와 식별자를 session note에 기록한다.
- 정리는 별도 승인된 단계로 취급한다. 사용자가 삭제를 요청하지 않으면 보존 위치만 보고한다.
- 제품이 실제 위험 행동을 요구하면 실행 대신 해당 지점을 `blocked` 또는 `requires_approval`로 관찰한다.

