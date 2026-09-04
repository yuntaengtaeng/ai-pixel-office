---
name: pixel-office-comment-guidelines
description: Apply AI Pixel Office conventions when writing, editing, or reviewing Korean JSDoc, source comments, and user-visible UI strings in TypeScript, JavaScript, or React code.
---

# AI Pixel Office Comment Guidelines

## 적용 범위

- 새로 작성하거나 변경하는 JSDoc과 일반 주석에 규칙 적용
- 새로 작성하거나 변경하는 모든 UI 노출 문자열에 문자 규칙 적용
- 사용자 요청이 없으면 변경 범위 밖의 기존 문구는 일괄 수정 금지

## JSDoc 규칙

- 한국어로 작성
- 설명형 문장보다 간결한 명사구 사용
- `한다`, `합니다`, `함` 대신 `조회`, `검증`, `반환`, `처리` 같은 명사형 사용
- 끝에 마침표 사용 금지
- 괄호 안의 기술 식별자는 원문 유지

```typescript
/** 프로젝트 실행 컨텍스트 조회 (runtime 지정 시 해당 런타임만) */
```

## 문자 규칙

변경하는 주석과 UI 노출 문자열에는 다음 규칙을 적용한다.

- 문장 끝 마침표 사용 금지
- 가운뎃점 사용 금지
- 자연어 구분용 하이픈과 유니코드 대시 사용 금지
- 유니코드 화살표 사용 금지
- 원문자 사용 금지
- 이모지 사용 금지
- 방향 표현이 꼭 필요하면 ASCII `->` 사용
- 나열은 쉼표 또는 `1)` `2)` 형식 사용

```typescript
/** client에서 server로 전달되는 최신 요청 처리 */
const message = "저장 완료";
const options = "1) 기본, 2) 사용자 지정";
```

## UI 문자열 규칙

- 제품에서 사용 중인 언어와 말투 유지
- JSDoc의 한국어 및 명사형 규칙을 UI 문자열에 강제하지 않음
- 버튼, 라벨, 안내 문구, 오류 문구, 스낵바, 모달 문구에 문자 규칙 적용
- 디자인 장식 목적의 특수문자와 이모지 제거

## 기술 문법 예외

변수명, 타입명, API 경로, URL, 버전, 소수점, CLI 옵션, 정규식 같은 기술 문법은 원문을 유지한다.
기술 식별자 내부 문자를 자연어 구분 기호로 오인해 변경하지 않는다. UI에 기술 값을 그대로 노출해야 하면
값의 필수 문법을 유지한다.

## 검토 순서

1. 변경된 JSDoc과 일반 주석 확인
2. 변경된 UI 노출 문자열 확인
3. JSDoc의 한국어와 명사형 종결 확인
4. 문장 끝 마침표와 금지 문자 확인
5. 나열 형식과 방향 표현 확인
6. 기술 문법 훼손 여부 확인
7. 리뷰라면 위반 문구와 교체 문구를 함께 제시하고, 구현이라면 요청 범위 안에서 직접 수정
