# Start command contract

## 입력

```yaml
scope: feature | full
target: string
duration: string
mode: simulation | live | hybrid
participants: all | persona id list
environment: string
data_policy: string
focus_questions: []
output_path: optional string
```

한국어의 `단위: 전체`는 `scope: full`로 정규화한다. 입력이 빠지면 다음 값을 쓴다.

- feature: 3개 체크포인트, 대상 기능의 진입부터 성공·실패 복구까지
- full: 5개 체크포인트, 설치/연결 → 첫 구성 → 첫 Task → 검토/후속 요청 → 재방문
- mode: simulation
- participants: all
- data_policy: synthetic-only, no deletion
- focus: discoverability, learnability, efficiency, error recovery, trust, return intent

대상이 전혀 특정되지 않은 feature 테스트처럼 결과가 크게 달라지는 누락만 한 문장으로 확인한다. 나머지는
채운 기본값을 Test Plan에 드러내고 진행한다.

## 제어 명령

- `시작`: Test Plan 확정 후 첫 체크포인트 실행
- `다음 세션`: 다음 Day/checkpoint 실행
- `중간 보고`: 현재까지의 패턴과 미확인 항목 출력
- `조건 변경: ...`: 이후 세션 조건을 변경하고 revision 기록
- `종료 및 종합`: 미실행 범위를 표시하고 최종 보고서 생성

