# Behavioral Eval

이 Eval은 출력 문장을 비교하지 않고 역할 경계, Handoff 계약과 프로젝트 불변 조건을 평가한다.

1. `tasks/`의 요청을 대상 Agent와 runtime에 제공
2. 대응하는 `rubrics/`의 `must_include`, `must_not` 기준으로 PASS, PARTIAL, FAIL 판정
3. `golden/`은 모범 문장이 아니라 반드시 관찰할 행동의 예시로만 사용
4. Codex와 Claude의 표현이 달라도 핵심 행동이 같으면 동등하게 판정

`node scripts/validate-eval.mjs`는 파일 연결과 rubric 필드만 검사하며 Agent 품질을 자동 증명하지 않는다.
