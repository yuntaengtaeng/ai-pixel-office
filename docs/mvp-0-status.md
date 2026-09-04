# MVP 상태

검증 기준일: 2026-09-03

## 완료

- [x] Codex App Server runtime adapter
- [x] Claude Code CLI stream-json runtime adapter
- [x] Claude Code live 실행·도구 이벤트·usage·cwd·session resume 검증
- [x] 구조화 이벤트와 tool activity 정규화
- [x] 실행 중 승인 요청과 동일 turn 재개
- [x] Workspace, Agent, Skill, Task, AgentRun 영속화
- [x] Node SQLite 전환과 기존 DB 자동 마이그레이션
- [x] Fastify API와 SSE
- [x] 권한 검증, 실행 guardrail, bounded JSONL log
- [x] 결과 승인, 변경 요청, 취소
- [x] 실제 HTTP → Codex → DB end-to-end smoke
- [x] Vite + React + TanStack Query 웹 앱
- [x] Today, Agents, Skills, Task Detail 화면
- [x] 연결 상태와 워크스페이스 기본 폴더 설정 화면
- [x] 에이전트 상세 편집·삭제·작업 기록·자주 맡기는 작업
- [x] 실행 진행 이벤트 저장·SSE 갱신·작업 상세 타임라인
- [x] 작업·에이전트·워크스페이스 프로젝트 폴더 우선순위
- [x] 여러 프로젝트 폴더 등록·선택·삭제
- [x] 픽셀 캐릭터 Codex·Claude 실행 엔진 배지
- [x] 캔버스 한글을 HTML 오버레이로 분리
- [x] 작업 생성과 담당 에이전트 배치 흐름 분리
- [x] 스킬·도구 권한이 필요 없는 대화형 에이전트
- [x] Windows/macOS/Linux 운영체제 폴더 선택기
- [x] Claude Code용 Figma 원격 MCP 연결과 상태 확인
- [x] Codex Figma MCP 상태 확인과 권한 기반 런타임 연결
- [x] PixiJS 오피스 상태 시각화
- [x] 품종·색·무늬·소품이 다른 반려동물 캐릭터 선택
- [x] Inbox 빠른 입력·보관·삭제·Task 전환
- [x] Today 작업 검색·상태 필터·활동 필터와 Task 연결
- [x] 다수 에이전트에 맞춰 확장되는 Pixel Office와 상태별 생활 애니메이션
- [x] 대기 말풍선 순환과 PixiJS 애플리케이션 정리 강화
- [x] Task별 2~8단계 순차 multi-agent workflow와 결과 handoff
- [x] 워크스페이스별 협업 순서 그룹 저장·불러오기·삭제

## 다음 단계

- [ ] Claude 네이티브 대화형 승인 지원 재검토 또는 사전 허용 fallback 유지
- [ ] 병렬 실행용 Git worktree 격리
- [ ] 호스팅 환경용 인증과 실행 sandbox

## 운영 가정

현재는 단일 사용자 로컬 실행을 가정합니다. API는 loopback에 바인딩됩니다. 각 런타임의 작업 디렉터리는 작업, 에이전트, 워크스페이스, 서버 실행 폴더 순으로 선택됩니다. Claude는 권한별 도구 허용 목록을 사용하고, Codex는 쓰기 권한이 없는 Agent를 read-only sandbox로 실행합니다.
