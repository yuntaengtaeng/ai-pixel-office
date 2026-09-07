# Reporting contract

각 finding은 다음을 포함한다: `id`, `title`, `scope`, `personas`, `checkpoint`, `evidence_type`, `evidence`,
`severity`, `frequency`, `task_impact`, `recommendation`, `confidence`.

`evidence_type`은 다음 중 하나다.

- `observed`: 실제 화면/명령/제품 반응에서 확인
- `simulated`: persona 제약을 적용한 시나리오 결과
- `inferred`: 문서·구조에서 추론했으나 직접 확인하지 못함

보고서는 성공한 점, 문제, persona 간 이견, 테스트 제약, 생성 데이터, 다음 검증을 모두 남긴다. persona 수를
통계적 사용자 표본처럼 해석하지 않으며, simulation 결과에 발생률 백분율을 사용하지 않는다.

