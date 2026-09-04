# AI Pixel Office 커뮤니티 / Agent·Skill 생태계 고도화 계획 v2

> Claude와 Codex를 기반으로 나만의 AI 팀을 만들고, 다른 사람들이 만든 Agent와 Skill을 안전하게 설치·Fork·Remix하여 내 팀을 확장하는 Workspace.

## 1. 목표와 제품 원칙

Community의 중심은 일반 게시글이 아니라 **실제로 설치하고 실행할 수 있는 Agent와 Skill**이다. Discussion, 리뷰, 제작자 프로필 같은 소셜 기능은 그 주변에 붙인다.

```text
Custom Agent Builder
→ Skill System
→ Portable Package
→ Community Registry
→ Install / Fork / Remix
→ AI Team Ecosystem
```

핵심 경계는 다음과 같다.

```text
Community       = 공유 / 발견 / 배포
Package         = 이동 가능한 Agent / Skill 정의
Local DB        = 설치 상태 / 관계 / 사용자 설정
Local Filesystem= Package 본문
Claude / Codex  = 실행 엔진
Runtime Sandbox = 실제 권한 강제
Pixel Office    = 업무/Agent 상태 시각화
```

## 2. Agent와 Skill

Skill은 재사용 가능한 능력이고 Agent는 능력을 조합한 AI 작업자다.

```text
Agent
├─ Identity
├─ Role
├─ Runtime: Claude | Codex
├─ Skills[]
├─ Permissions
└─ Instructions
```

예:

```text
Senior UI Reviewer
Runtime: Claude
Skills:
- Figma UI Review
- Design System Check
- Accessibility Review
```

제품 철학은 **직업을 선택하는 것이 아니라 능력을 조합해 AI 직원을 만든다**이다.

## 3. 로컬 저장 구조

현재 로컬 DB를 제거하지 않는다. 저장 책임을 분리한다.

```text
SQLite / Local DB
= 설치 상태, 관계, 사용자 설정, 실행 정보

Filesystem
= 실제 Agent / Skill Package
```

권장 구조:

```text
~/.pixel-office/
├─ app.db
├─ packages/
│  ├─ installed/          # Community 설치본: immutable
│  │  ├─ skills/
│  │  └─ agents/
│  └─ local/              # 사용자가 만든/Fork한 editable package
│     ├─ skills/
│     └─ agents/
└─ runtime/
```

DB에는 `packageId`, `installedVersion`, `path`, `source`, `enabled`, `installedAt`, `packageHash` 등의 메타데이터를 둔다.

## 4. Skill Package

Skill은 DB row나 prompt 문자열이 아니라 설치 가능한 작은 패키지다.

```text
figma-ui-review/
├─ manifest.json
├─ SKILL.md
├─ schemas/
└─ tests/
   ├─ input.json
   └─ expected.schema.json
```

향후 executable Skill을 지원할 경우에만 `scripts/`를 추가한다.

예시 Manifest:

```json
{
  "id": "figma-ui-review",
  "name": "Figma UI Review",
  "version": "1.2.0",
  "author": "username",
  "entry": "SKILL.md",
  "runtimes": [
    {
      "engine": "claude",
      "minVersion": "x.y.z"
    }
  ],
  "requiredTools": ["figma"],
  "requiredPermissions": ["figma.read"]
}
```

로컬과 Community는 동일한 Package Format을 사용한다.

## 5. Agent Package

Agent는 Skill dependency와 역할/설정을 담는 가벼운 정의다.

```json
{
  "id": "senior-ui-reviewer",
  "name": "Senior UI Reviewer",
  "version": "1.0.0",
  "runtime": "claude",
  "role": "Senior Product Design Reviewer",
  "skills": [
    "figma-ui-review@1.2.0",
    "design-system-check@2.0.1"
  ]
}
```

초기에는 Skill version range보다 **exact version pinning**을 사용한다.

## 6. Runtime 호환성과 실행 재현성

### 6.1 Config 재현만으로는 부족하다

동일한 Agent/Skill 파일을 가져왔다고 같은 동작이 보장되는 것은 아니다.

결과에 영향을 주는 요소:

- Claude/Codex 버전
- Tool 버전
- Workspace context
- 외부 서비스 상태
- 모델의 비결정성
- OS/실행 환경

따라서 Manifest에 Runtime compatibility를 둔다.

```ts
type RuntimeCompatibility = {
  engine: "claude" | "codex";
  minVersion?: string;
  maxVersion?: string;
};
```

필요하면 Tool compatibility도 확장한다.

### 6.2 동일 출력이 아니라 Behavior Contract를 검증한다

자연어 결과를 byte-for-byte 동일하게 만드는 것을 목표로 하지 않는다.

대신:

```text
동일 Fixture 입력
→ 실행 성공
→ 필요한 Tool 사용 가능
→ Expected Output Contract 만족
```

을 재현성의 기준으로 삼는다.

예를 들어 UI Review Skill의 expected schema:

```json
{
  "required": ["issues"],
  "properties": {
    "issues": {
      "type": "array"
    }
  }
}
```

Phase 2의 성공 조건은 단순히 "동일 config 재현"이 아니라 **다른 환경에서 동일 fixture가 contract를 만족하는 것**이다.

## 7. Test Fixture

공유 Skill에는 최소 하나의 테스트 fixture를 권장하고, Publish 가능한 Skill에는 이를 필수화한다.

```text
tests/
├─ basic/
│  ├─ input.json
│  └─ expected.schema.json
└─ README.md
```

Publish 전:

```text
Manifest Validation
→ Runtime Compatibility Check
→ Permission Validation
→ Test Fixture 실행
→ Output Contract Validation
→ Publish
```

새 버전 Publish 시에도 fixture를 다시 실행해 regression을 확인한다.

테스트 통과는 "항상 같은 품질"을 보장하는 인증이 아니라 **최소 실행 가능성과 output contract를 검증하는 품질 게이트**다.

## 8. Permission: 선언과 강제의 분리

Manifest의 Permission은 요청/선언일 뿐이다.

```text
Skill Manifest
= 이 Skill이 필요하다고 선언한 권한

Runtime Security Layer
= 실제로 허용된 행동만 실행되도록 강제
```

예를 들어 Skill이:

```json
{
  "requiredPermissions": ["figma.read"]
}
```

만 선언했더라도 SKILL.md가 파일 삭제를 지시할 수 있다.

따라서 안전성은 prompt를 믿는 것으로 해결하지 않는다.

```text
SKILL.md
"파일을 삭제해라"
        ↓
Agent Runtime
        ↓
filesystem.delete 권한 없음
        ↓
BLOCK
```

## 9. Runtime Security Capability Gate

Community Skill 실행 가능 여부는 Runtime의 실제 보안 능력에 따라 결정한다.

```ts
type RuntimeSecurityCapabilities = {
  filesystemSandbox: boolean;
  commandSandbox: boolean;
  networkPolicy: boolean;
  permissionInterception: boolean;
};
```

Skill 요구사항과 Runtime capability를 실행 전에 비교한다.

```text
Skill
requires:
- file.read

Runtime
supports enforcement:
- filesystemSandbox ✓

→ 실행 가능
```

반대로 필요한 권한 경계를 Runtime이 강제할 수 없다면:

```text
→ 경고
→ 제한된 모드
또는
→ Community Skill 실행 차단
```

Community의 Trust 모델은 Claude/Codex Runtime의 실제 sandbox/permission capability 위에 구축되어야 한다.

**Runtime이 강제할 수 없는 Permission을 제품 UI가 강제 가능한 것처럼 표현하지 않는다.**

## 10. Runtime Feasibility 선행 조건

Community 고도화 전에 기존 Runtime Phase 0에서 다음을 검증한다.

- 구조화 이벤트 관측
- Tool 실행 관측
- Permission 요청 관측
- 승인/거절 주입
- 동일 세션 재개
- Sandbox 범위
- 파일 접근 제한
- command 제한
- network 제한 가능 여부
- cancellation

Claude/Codex 각각에 Capability Matrix를 유지한다.

```text
                         Claude   Codex
Structured Events          ?        ?
Permission Round-trip      ?        ?
Filesystem Sandbox         ?        ?
Command Sandbox            ?        ?
Network Policy             ?        ?
Session Resume             ?        ?
Cancellation               ?        ?
```

Community 보안 기능은 이 표에서 실제로 검증된 capability만 사용한다.

## 11. Trust Level

### Level 1 — Instructions Only

```text
SKILL.md
Prompt
Output Schema
Test Fixture
```

외부 실행 코드 없음. Community 초기 버전의 중심이다.

### Level 2 — Known Tool Binding

제품이 알고 있는 Figma/Git/Browser/Filesystem 등의 Tool을 사용한다.

Permission + Runtime Capability Gate가 필요하다.

### Level 3 — Executable

```text
scripts/
commands/
custom executable
```

신뢰되지 않은 코드를 실행할 수 있으므로 초기 Community에서는 지원하지 않는다.

Sandbox가 충분히 검증된 이후 별도 설계한다.

## 12. Install Flow

```text
Community
→ Agent/Skill 선택
→ Manifest 확인
→ Runtime 호환성 검사
→ Dependency 검사
→ Permission 검사
→ Runtime Security Capability 검사
→ Package 다운로드
→ Hash 검증
→ immutable installed 영역에 저장
→ Local Registry 등록
```

설치 UI에 반드시 표시:

- 제작자
- 버전
- Runtime 호환 범위
- 필요한 Skill/Tool
- Permission
- Trust Level
- 실행 코드 포함 여부
- Test Fixture 통과 여부

## 13. Immutable Installed Package와 Editable Local Package

로컬 우선과 Package 무결성의 충돌을 해결하기 위해 두 종류를 분리한다.

### Community Installed Package

```text
source: community
editable: false
immutable: true
hash verified: true
```

Community에서 받은 특정 버전은 직접 수정하지 않는다.

### Local / Fork Package

```text
source: local | fork
editable: true
communityHash: 없음 또는 origin 정보만 유지
```

사용자가 설치된 Community Skill을 수정하려 하면:

```text
이 Package는 Community 설치본입니다.
수정하려면 로컬 Fork를 생성해야 합니다.

[취소] [Fork 후 수정]
```

Fork 이후에는 새로운 로컬 identity를 갖는다.

## 14. Package Hash 검증 시점

Community package는 다음 시점에 검증한다.

### 설치 시

다운로드된 파일과 Registry의 package hash를 비교한다.

### 실행 전

설치된 immutable package의 hash를 lightweight verify한다.

변조 감지 시:

```text
Package integrity failed
→ 실행 차단
→ 재설치 또는 Fork 안내
```

Local/Fork package는 Community hash를 강제하지 않는다. 대신 로컬 변경 상태를 정상적인 editable 상태로 취급한다.

즉:

```text
Community Package 수정
≠ 정상 local edit

Community Package 수정
= integrity violation

수정이 필요
→ Fork
→ Local Package에서 수정
```

## 15. Version

공유 Package는 Semantic Versioning을 사용한다.

```text
1.0.0
1.1.0
2.0.0
```

배포된 특정 버전은 immutable하다.

```text
figma-ui-review@1.2.0
→ 수정 불가

변경 필요
→ 1.2.1 또는 1.3.0 배포
```

## 16. Source / Provenance

```ts
type PackageSource =
  | { type: "local" }
  | {
      type: "community";
      packageId: string;
      authorId: string;
      version: string;
    }
  | {
      type: "fork";
      originPackageId: string;
      originVersion: string;
    };
```

이를 통해:

- 원본 보기
- 제작자 표시
- 업데이트 확인
- Fork lineage
- 로컬 수정 여부

를 관리한다.

## 17. Fork는 Snapshot이다

MVP에서 Fork는 Git branch처럼 취급하지 않는다.

```text
Original v1.3.0
       ↓ Fork
My Skill v1.0.0

이후 두 Package는 독립
```

원본이 v2.0.0으로 업데이트되어도 자동 merge하지 않는다.

UI에서는 정보만 제공한다.

```text
Forked from: Senior UI Reviewer v1.3.0
Upstream latest: v2.0.0

[원본 변경사항 보기]
```

MVP에서는 다음을 지원하지 않는다.

- upstream merge
- automatic rebase
- 3-way merge
- 원본 변경 자동 적용

필요하면 사용자가 새 버전을 다시 Fork하거나 변경사항을 수동 적용한다.

## 18. Remix

장기적으로 여러 Agent/Skill을 조합하는 Remix를 지원한다.

```text
React Reviewer
+ Company Coding Convention
+ Accessibility Review
↓
My Frontend Reviewer
```

Remix 결과 역시 새로운 Local Package다.

## 19. Publish Quality Gate

Publish는 단순 파일 업로드가 아니다.

### Skill Publish

```text
Local Skill
→ Manifest Validation
→ Runtime Compatibility Validation
→ Permission Validation
→ Security Capability Check
→ Test Fixture 최소 1회 성공
→ Output Contract 만족
→ Package Hash 생성
→ Version immutable 등록
→ Publish
```

**Local Test는 선택이 아니라 Publish 필수 조건**이다.

### Agent Publish

```text
Agent Definition Validation
→ Skill dependency resolve
→ Runtime compatibility
→ Permission aggregate
→ 최소 smoke run
→ Publish
```

테스트 환경/Runtime 버전도 Publish metadata에 기록한다.

예:

```text
Verified with:
Claude x.y.z
Figma Tool a.b.c
2026-09-04
```

이것은 절대적 품질 보증이 아니라 "어떤 환경에서 최소 동작이 확인되었는가"를 보여주는 provenance다.

## 20. Community Explore

Community 홈은 포럼보다 탐색 중심이다.

```text
Explore

🔥 Trending Agents
🎨 Figma Design Reviewer
👨‍💻 Strict React Reviewer

🔥 Trending Skills
Figma UI Review
React Review
Accessibility Audit

✨ New
최근 등록된 Agent / Skill
```

필터:

- Claude / Codex
- Design / Development / PM / Research / Review
- Trust Level
- Verified Runtime
- Recently Updated
- Most Installed

## 21. Agent / Skill 상세

Agent 상세:

```text
Senior UI Reviewer
by @username

Runtime
Claude

Verified Runtime
x.y.z

Skills
✓ Figma UI Review
✓ Design System Check

Permissions
Figma Read

Trust
Level 2

Tests
✓ Smoke Test Passed

[우리 사무실에 추가]
[Fork]
```

Skill 상세에는 추가로:

- SKILL.md 설명
- Test/Output Contract
- Runtime compatibility
- Required Tools
- Changelog
- 사용 중인 Agent

를 보여준다.

## 22. Pixel Office 연결

```text
My Office
🎨 UI Reviewer   👨‍💻 FE Dev
       + Hire Agent
            ↓
      Community Explore
            ↓
          Install
            ↓
      Office에 Agent 추가
```

Community는 별도 SNS가 아니라 **내 AI 팀을 확장하는 장소**로 느껴져야 한다.

## 23. 로컬 우선

```text
Community
= 발견 / 공유 / 다운로드

Local Workspace
= 설치 / 설정 / 실행
```

Community 서버 장애가 발생해도 이미 정상 설치된 Package는 실행 가능해야 한다.

단, immutable Community Package의 로컬 무결성 검증은 계속 적용한다.

## 24. Repository 추상화

```ts
interface SkillRepository {
  get(id: string): Promise<Skill | null>;
  list(): Promise<Skill[]>;
  install(pkg: SkillPackage): Promise<void>;
  fork(id: string): Promise<Skill>;
  uninstall(id: string): Promise<void>;
}

interface AgentRepository {
  get(id: string): Promise<Agent | null>;
  list(): Promise<Agent[]>;
  install(pkg: AgentPackage): Promise<void>;
  fork(id: string): Promise<Agent>;
  uninstall(id: string): Promise<void>;
}
```

UI/Runtime은 SQLite/File/Remote 저장 방식을 몰라야 한다.

## 25. Community Registry 추상화

```ts
interface CommunityRegistry {
  searchAgents(query: SearchQuery): Promise<PublishedAgent[]>;
  searchSkills(query: SearchQuery): Promise<PublishedSkill[]>;

  getAgent(id: string, version?: string): Promise<AgentPackage>;
  getSkill(id: string, version?: string): Promise<SkillPackage>;

  publishAgent(pkg: AgentPackage): Promise<void>;
  publishSkill(pkg: SkillPackage): Promise<void>;
}
```

검색/배포와 로컬 설치 책임을 분리한다.

## 26. 개발 단계

### Phase 0 — Runtime Security Capability 재검증

Community 개발 전에 Claude/Codex의 실제 permission/sandbox capability를 표로 확정한다.

성공 조건:
- 선언한 Permission보다 강한 행동을 Runtime에서 차단 가능
- 불가능한 capability는 명시적으로 표시
- Community 실행 정책이 검증된 capability만 사용

### Phase 1 — Local Package Model

- SkillManifest
- AgentDefinition
- RuntimeCompatibility
- version / author / source
- permissions
- Trust Level
- Test Fixture
- Package Hash
- Repository abstraction

### Phase 2 — Import / Export + Behavior Reproduction

```text
사용자 A Export
→ 사용자 B Import
→ 동일 Config 복원
→ Runtime compatibility 확인
→ 동일 Fixture 실행
→ Expected Output Contract 만족
```

**성공 조건은 config 동일성이 아니라 behavior contract 재현이다.**

### Phase 3 — Immutable Install / Local Fork

- Community installed 영역과 local 영역 분리
- 설치 시 hash 검증
- 실행 전 integrity verify
- 설치본 직접 수정 차단
- Fork 후 수정

### Phase 4 — Dependency / Permission Resolver

```text
Agent
→ exact Skill dependency
→ Permission aggregate
→ Runtime capability gate
→ 설치 가능 여부 결정
```

### Phase 5 — Publish Validation Pipeline

- Manifest validator
- Runtime compatibility validator
- Permission validator
- Fixture runner
- Output contract validator
- Package hasher
- immutable version publisher

### Phase 6 — Community Registry

최소 서버:

```text
User
PublishedAgent
AgentVersion
PublishedSkill
SkillVersion
Install
Fork
```

기능:

- Publish
- Search
- Detail
- Download
- Install Count

### Phase 7 — Explore / Install

- Trending / New
- Search / Filter
- Agent/Skill 상세
- Install
- Runtime compatibility 표시
- Permission/Trust/Test 정보 표시

### Phase 8 — Pixel Office 연결

```text
Hire Agent
→ Explore
→ Install
→ Office에 추가
```

### Phase 9 — Fork / Remix

- Snapshot Fork
- Origin metadata
- Skill 추가/제거
- 재배포
- upstream latest 정보 표시
- upstream merge는 하지 않음

### Phase 10 — Social Layer

제품 사용성 검증 이후:

- Like
- Review
- Discussion
- Comment
- Report
- Creator Profile

### Phase 11 — Updates

새 버전 감지:

```text
Installed: 1.2.0
Available: 1.3.0

[Changelog]
[Permission 변경]
[Test 상태]
[업데이트]
```

자동 업데이트는 초기에는 지원하지 않는다.

## 27. Community MVP Definition of Done

- [ ] Claude/Codex Runtime Security Capability Matrix 존재
- [ ] Skill Package 지원
- [ ] Agent Package 지원
- [ ] Runtime version compatibility 지원
- [ ] Test Fixture / Output Contract 지원
- [ ] Import / Export 지원
- [ ] 다른 환경에서 behavior contract 재현 검증
- [ ] Permission Manifest 지원
- [ ] Runtime Capability Gate 지원
- [ ] immutable Community install 영역 존재
- [ ] editable Local/Fork 영역 존재
- [ ] install 및 pre-run hash 검증
- [ ] Package version / source / provenance 지원
- [ ] Publish 전 최소 성공 실행 필수
- [ ] Community Publish
- [ ] Agent/Skill 검색 및 상세
- [ ] Install
- [ ] Snapshot Fork
- [ ] Install Count

## 28. 명시적 Non-Goals

초기 Community에서는 하지 않는다.

- 일반 자유게시판 중심 Community
- 복잡한 SNS Feed / DM
- Agent 판매/결제
- Community 서버에서 Agent 실행
- 자동 Package 업데이트
- AI 기반 추천
- Creator 수익 배분
- 신뢰되지 않은 arbitrary executable Skill
- 복잡한 semantic version dependency resolver
- Fork upstream automatic merge
- Fork rebase / 3-way merge
- 자연어 출력의 완전한 결정론적 재현
- Runtime이 강제할 수 없는 Permission을 UI만으로 안전하다고 표현하는 것

## 29. 주요 리스크

### 실행 재현성

같은 prompt/package라도 환경과 모델 비결정성 때문에 결과가 달라질 수 있다.

대응:
- Runtime version compatibility
- Fixture
- Output contract
- Verified environment metadata

### Permission 선언과 실제 행동 불일치

대응:
- Manifest는 선언
- Runtime Sandbox가 실제 enforcement
- Runtime Capability Gate
- 강제 불가능하면 실행 제한

### Fork 유지보수 복잡성

대응:
- Fork = snapshot
- upstream merge는 non-goal
- origin/latest 정보만 제공

### 저품질 Package

대응:
- Publish 전 필수 local execution
- Fixture / contract validation
- 이후 install/fork/review 기반 reputation

### 로컬 파일 변조

대응:
- Community 설치본 immutable
- 설치/실행 전 hash verify
- 수정하려면 Local Fork

### Community가 본 제품보다 커지는 문제

Community 목적을 다음으로 제한한다.

> 더 좋은 Agent와 Skill을 발견하고 자신의 Office에 가져오는 것.

## 30. 지금 가장 먼저 해야 할 작업

Community 서버부터 만들지 않는다.

```text
1. Claude/Codex Runtime Security Capability 재검증
2. 현재 Skill DB 모델 분석
3. SkillManifest / AgentDefinition 정의
4. RuntimeCompatibility 추가
5. Permission + Runtime Capability Gate 정의
6. Test Fixture / Output Contract 정의
7. installed immutable / local editable 저장 영역 분리
8. Package hash 정책 구현
9. Export / Import 구현
10. 다른 환경에서 Behavior Contract 재현
11. Snapshot Fork 구현
12. Publish Validation Pipeline
13. 그 이후 Community Registry
```

## 31. 최종 구조

```text
                         Community
                             │
                 ┌───────────┴───────────┐
               Agents                  Skills
                 │                        │
                 └──────── Install ───────┘
                             │
                  Manifest / Hash / Test
                             │
                    Security Capability
                             │
                             ▼
                      Local Workspace
                 ┌───────────┴───────────┐
          Immutable Installed       Editable Local/Fork
                 │                        │
                 └───────────┬────────────┘
                             │
                        Agent Runtime
                       Claude / Codex
                             │
                    Permission Sandbox
                             │
                           Tasks
                             │
                       Pixel Office
```

## 32. 장기 비전

사용자는 Claude나 Codex 자체를 소비하는 것이 아니라 **역할과 능력을 가진 AI 팀을 구성**한다.

다른 사용자가 검증하고 공유한 능력을 설치하고, 자신의 환경에 맞게 Fork/Remix하며, 그 결과를 다시 생태계에 공유한다.

Pixel Office는 AI 팀이 일하는 인터페이스이고, Community는 그 팀의 능력을 확장하는 Registry이자 생태계다.

중요한 제품 원칙은 끝까지 유지한다.

> 공유 가능해야 한다.
>
> 하지만 공유된 것이 실제로 실행 가능하고, 어떤 환경에서 검증됐으며, 어떤 권한을 요구하고, Runtime이 그 권한을 실제로 강제할 수 있는지도 함께 설명할 수 있어야 한다.
