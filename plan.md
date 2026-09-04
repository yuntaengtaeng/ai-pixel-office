# AI Pixel Office — Development Plan

## 1. Product Summary

AI Pixel Office is a workspace where users create and manage custom AI agents powered only by **Claude** and **Codex**.

The product is neither model-centric nor based on creating a fixed position for every kind of work. Users should not need to think in terms of "Claude Agent", "Codex Agent", or a permanently separate agent for every job title. Instead, they compose a reusable agent with:

- a name
- a role
- one or more skills
- a model/runtime: Claude or Codex
- permissions
- workspace context

The main experience is a **pixel-style virtual office** where each agent is represented as a character and visually reflects its current work state.

The product should be usable not only by developers, but also by PMs and designers.

Examples:

### Designer Team

- Agent A: Figma UI Reviewer
- Agent B: Component Specification Generator

### Developer Team

- Agent A: Frontend Developer
- Agent B: Code Reviewer

The user can create different capabilities by mapping skills to reusable agents. A role gives the agent an understandable identity, while its mapped skills define what it can actually do. The same Codex or Claude runtime can therefore become a UI analyst, implementation specialist, reviewer, or tester without treating each position as a separate product primitive.

This skill-based composition is the primary product differentiator. The pixel office makes the system approachable and observable, but the durable value comes from assembling, reusing, and coordinating agent capabilities for real project work.

---

## 2. Core Product Principles

### 2.1 Agents are capability compositions, not models or fixed positions

Bad UX:

- Claude Agent
- Codex Agent
- creating a new agent for every narrow job title
- treating a role name as the agent's full capability definition

Preferred UX:

- a reusable agent identity
- an understandable role
- mapped skills for the current kind of work
- explicit permissions and project context

Claude and Codex are execution engines behind the agent. A role explains the agent at a glance, but skills are the composable units that determine its behavior and expected output.

```text
Custom Agent
    |
    +-- Identity
    +-- Role (human-readable purpose)
    +-- Mapped Skills (actual capabilities)
    +-- Permissions
    +-- Workspace Context
    |
    +-- Runtime
         +-- Claude
         +-- Codex
```

For example, one Codex-backed agent can be reused as:

```text
Agent: Momo
  +-- UI Analysis Skill
  +-- React Implementation Skill
  +-- Accessibility Review Skill
```

A workflow can select the skills needed at each step instead of requiring a separately created permanent position for every step.

---

### 2.2 Skills are first-class domain objects

A skill is not just a prompt fragment.

A skill should describe:

- what the agent knows how to do
- what instructions it receives
- which tools it can use
- what permissions it requires
- what result it should produce

Example:

```text
Skill: Figma UI Review

Instructions
- inspect spacing
- inspect typography
- validate design token usage
- detect inconsistent component usage
- check basic accessibility issues

Tools
- Figma Reader
- Workspace Design System Reader

Output
- issues
- severity
- target frame/component
- recommendation
```

---

### 2.3 Product-level state must be separated from runtime-level state

Do not expose raw CLI events directly to the UI.

Runtime events may include:

- text stream
- tool call
- file edit
- command execution
- permission request
- turn completion
- error

These should be normalized into product states.

```ts
type WorkStatus =
  "assigned" | "working" | "needs_input" | "needs_approval" | "blocked" | "completed" | "failed";
```

The pixel office only consumes normalized states.

---

### 2.4 Human-in-the-loop is a core workflow

The system should not assume all work is fully autonomous.

Common flow:

```text
Task
  ↓
Agent works
  ↓
Result submitted
  ↓
Human review
  ↓
Approve / Request changes
  ↓
Next task or agent
```

---

## 3. Main Domain Model

The product domain can grow into these entities:

1. Workspace
2. Agent
3. Skill
4. Task
5. AgentRun
6. ActivityLog
7. Input (post-MVP)
8. Workflow (post-MVP)

For the first end-to-end MVP, keep the active domain intentionally small:

- Workspace
- Agent
- Skill
- Task
- AgentRun

Input, Workflow, and full ActivityLog UX should not block runtime validation.

---

## 4. Domain Definitions

## 4.1 Workspace

Represents one user/team workspace.

```ts
type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

A workspace owns:

- agents
- skills
- inputs
- tasks
- workflows
- activity logs

---

## 4.2 Agent

```ts
type AgentModel = "claude" | "codex";

type Agent = {
  id: string;
  workspaceId: string;

  name: string;
  role: string;
  description?: string;

  model: AgentModel;

  skillIds: string[];

  permissions: AgentPermissions;

  systemPrompt?: string;

  createdAt: string;
  updatedAt: string;
};
```

Permissions:

```ts
type AgentPermissions = {
  fileRead?: boolean;
  fileWrite?: boolean;
  terminal?: boolean;
  git?: boolean;
  browser?: boolean;
  figma?: boolean;
};
```

---

## 4.3 Skill

```ts
type Skill = {
  id: string;
  workspaceId?: string;

  name: string;
  category: string;
  description: string;

  instructions: string;

  tools: ToolBinding[];

  requiredPermissions?: string[];

  outputSchema?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};
```

A skill may be:

- built-in
- workspace-created
- user-created

Example skill categories:

```text
Design
- Figma UI Review
- Design System Check
- Accessibility Review
- Component Specification

Frontend
- React
- TypeScript
- API Integration
- Component Generation

Engineering
- Git
- Code Review
- Refactoring
- Test Review
```

---

## 4.4 Input

Input is a captured piece of work context that is not necessarily a task yet.

Examples:

- request
- feedback
- idea
- message
- uploaded file

```ts
type InputType = "request" | "feedback" | "idea" | "message" | "file";

type InputStatus = "inbox" | "triaged" | "converted" | "archived";

type Input = {
  id: string;
  workspaceId: string;

  type: InputType;
  title?: string;
  content: string;

  status: InputStatus;

  createdAt: string;
  updatedAt: string;
};
```

Inputs can be manually or automatically converted into Tasks.

**MVP note:** Input/Inbox is a post-MVP workflow feature. MVP-0 creates Tasks directly so runtime validation is not coupled to triage UX.

---

## 4.5 Task

```ts
type TaskStatus =
  "todo" | "working" | "needs_review" | "needs_input" | "blocked" | "done" | "failed";

type Task = {
  id: string;
  workspaceId: string;

  title: string;
  description?: string;

  status: TaskStatus;

  assigneeAgentId?: string;

  sourceInputId?: string;

  dueDate?: string;

  priority?: "low" | "medium" | "high";

  result?: TaskResult;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

---

## 4.6 Task Result

```ts
type TaskResult = {
  summary: string;

  artifacts?: Array<{
    type: string;
    name: string;
    path?: string;
    url?: string;
  }>;

  metadata?: Record<string, unknown>;
};
```

---

## 4.7 Agent Run

Represents one concrete execution of Claude or Codex.

```ts
type AgentRunStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

type AgentRun = {
  id: string;

  taskId: string;
  agentId: string;

  runtime: "claude" | "codex";

  status: AgentRunStatus;

  startedAt?: string;
  finishedAt?: string;

  // Do not persist an unbounded raw event array in the primary DB row.
  // Store only normalized/summary fields here.
  eventLogRef?: string;

  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
  };

  error?: string;
};
```

---

## 4.8 Workflow

Workflow defines agent-to-agent task handoff.

Example:

```text
UI Reviewer
  ↓
Component Builder
  ↓
Code Reviewer
```

MVP version:

```ts
type WorkflowStep = {
  id: string;
  agentId: string;
  order: number;
};

type Workflow = {
  id: string;
  workspaceId: string;

  name: string;

  steps: WorkflowStep[];

  createdAt: string;
  updatedAt: string;
};
```

Do not build a complex DAG workflow engine initially.

Start with sequential workflows.

### 4.8.1 Planned — Skill-bound Workflow Step Contract

A workflow must not rely only on an agent's role to infer where one step ends. Use three separate responsibilities:

```text
Agent         = who performs the work
Skill         = reusable knowledge for how to perform it
Workflow Step = what this agent must do and hand off in this task
```

Planned sequential step definition:

```ts
type WorkflowStepContract = {
  agentId: string;
  skillIds: string[];

  instruction: string;
  expectedHandoff: string;

  // A step may further restrict the agent, but never grant a permission
  // that the agent itself does not have.
  allowFileWrite: boolean;
};
```

The initial UI should keep this compact:

- `이 단계에서 할 일`
- `완료 후 전달할 결과`
- `파일 수정 허용`
- optional Skill selection

At runtime, the Orchestrator compiles only the relevant step contract and selected Skills together with the preceding step's handoff. It must explicitly tell the agent its step number, scope, expected output, and whether file modification is allowed.

Reusable workflow presets should persist the complete ordered contract, not only the agent IDs:

```text
UI Reviewer + UI Review Skill + analysis-only instruction
    ↓
Frontend Developer + React Skill + implementation instruction
    ↓
Code Reviewer + Code Review Skill + review-only instruction
```

Applying a preset to a Task copies the preset contract so Task-specific instructions can be edited without changing the original preset.

---

## 4.9 Activity Log

Every important user or agent action should be recorded.

```ts
type ActivityType =
  | "input_created"
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "approval_requested"
  | "task_approved"
  | "change_requested"
  | "agent_created"
  | "workflow_started";

type ActivityLog = {
  id: string;
  workspaceId: string;

  type: ActivityType;

  agentId?: string;
  taskId?: string;

  message: string;

  createdAt: string;

  metadata?: Record<string, unknown>;
};
```

---

# 4.10 Persistence Strategy

Use a relational database for durable product state.

Persist in the primary database:

- Workspace
- Agent
- Skill
- Task
- AgentRun summary/status
- approvals
- usage/cost summary
- normalized ActivityLog entries

Do **not** continuously append every raw Claude/Codex event into a single `AgentRun.rawEvents` JSON column.

Raw runtime events should use a separate append-oriented log mechanism, for example:

```text
AgentRun
  id
  status
  startedAt
  finishedAt
  eventLogRef
  usage summary
       |
       +--> runtime log file / object storage / dedicated event table
```

For a local-first MVP, newline-delimited JSON files per run are acceptable.

Example:

```text
.runtime-logs/
  <run-id>.jsonl
```

The database remains the source of truth for product state. Raw logs are diagnostic/audit data.

Retention must be bounded. Do not keep unlimited runtime logs by default.

---

# 5. Today Workspace

The default workspace home should focus on daily work.

Main sections:

```text
Today

Inbox
- new inputs

Todo
- tasks scheduled for today

Working
- tasks currently being executed

Needs Review
- tasks awaiting human approval

Blocked
- tasks requiring input or blocked by errors

Done Today
- completed tasks
```

Recommended layout:

```text
+-----------------------------------------------------+
| Today                                               |
+----------------------+------------------------------+
| Todo                 | AI Office                    |
|                      |                              |
| □ Figma UI Review    | 🎨 UI Reviewer              |
| □ Build Login UI     |    Working                  |
| □ Review PR          |                              |
|                      | 👨‍💻 Frontend Agent          |
|                      |    Waiting                   |
+----------------------+------------------------------+
| Needs Review                                        |
| 1 item                                              |
+-----------------------------------------------------+
| Done Today                                          |
| ✓ Button spacing review                            |
| ✓ Login API type definition                        |
+-----------------------------------------------------+
```

---

# 6. Pixel Office State Mapping

The pixel office is a visualization of the actual task state.

Example mapping:

```text
todo
→ agent idle / at desk

working
→ typing / working animation

needs_review
→ agent walks to user's desk

needs_input
→ speech bubble / question state

blocked
→ warning icon

done
→ short completion animation, then idle
```

Do not couple the pixel renderer directly to Claude/Codex event types.

Use:

```text
Claude/Codex Event
        ↓
Runtime Adapter
        ↓
Normalized Agent Event
        ↓
Task State
        ↓
Pixel Office
```

---

# 7. Agent Runtime Architecture

## 7.1 High-level architecture

```text
                    Web Client
                       |
          +------------+------------+
          |                         |
     Today Workspace           Pixel Office
          |                         |
          +------------+------------+
                       |
                  API / Realtime
                       |
                  Orchestrator
                       |
          +------------+------------+
          |                         |
    Claude Adapter              Codex Adapter
          |                         |
   Claude Runtime              Codex Runtime
          |
          +-------- Workspace / Files / Tools
```

---

## 7.2 Agent Adapter

The Orchestrator must not depend directly on model-specific CLI behavior.

```ts
interface AgentAdapter {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
  cancel(runId: string): Promise<void>;
}
```

Example input:

```ts
type AgentRunInput = {
  runId: string;
  task: Task;
  agent: Agent;
  skills: Skill[];

  workspacePath?: string;

  context?: Record<string, unknown>;
};
```

Normalized events:

```ts
type AgentEvent =
  | {
      type: "started";
    }
  | {
      type: "message";
      content: string;
    }
  | {
      type: "tool_started";
      tool: string;
    }
  | {
      type: "tool_completed";
      tool: string;
    }
  | {
      type: "permission_requested";
      permission: string;
    }
  | {
      type: "artifact_created";
      artifact: {
        name: string;
        type: string;
        path?: string;
      };
    }
  | {
      type: "completed";
      result: TaskResult;
    }
  | {
      type: "failed";
      error: string;
    };
```

---

# 8. Claude / Codex Runtime Strategy

The project supports only:

- Claude
- Codex

Do not introduce unnecessary multi-model abstractions.

However, isolate the two implementations behind adapters because:

- CLI flags may differ
- output formats may differ
- permission flows may differ
- streaming formats may differ

Before building the full UI, verify the following capabilities for the first runtime, then repeat the spike for the second runtime:

1. Non-interactive execution support
2. Machine-readable output
3. Streaming output/event format
4. Tool execution events
5. Permission request observability
6. Programmatic approval/rejection injection
7. Continuation of the same run/session after an approval decision
8. Cancellation behavior
9. Workspace state after cancellation
10. Exit/error codes
11. Session resume capability
12. Working-directory support
13. Token/usage observability where available

Do not assume that an interactive TTY permission prompt can be converted into a product-level approval flow. This is a Phase 0 feasibility requirement.

Avoid relying on raw terminal text parsing unless no structured format exists.

If raw parsing is required, contain it inside the runtime adapter.

---

# 9. Runtime State Normalization

Do not pretend runtime events perfectly map to:

```text
THINKING
CODING
RUNNING
```

Instead normalize observable activity.

Example internal state:

```ts
type AgentActivity =
  | "idle"
  | "processing"
  | "using_tool"
  | "waiting_permission"
  | "waiting_user"
  | "completed"
  | "failed";
```

Product-facing Task state remains:

```text
todo
working
needs_review
needs_input
blocked
done
failed
```

---

# 10. Skills Runtime

At execution time, the selected skills should be compiled into the agent instructions.

Example:

```text
Agent
  Role: UI Reviewer

Skills:
  - Figma UI Review
  - Design System Check

Task:
  Review the checkout screen
```

Runtime prompt construction:

```text
SYSTEM
You are the UI Reviewer.

ROLE
Validate UI quality from a product design perspective.

SKILL: FIGMA UI REVIEW
...

SKILL: DESIGN SYSTEM CHECK
...

TASK
Review the checkout screen.

AVAILABLE TOOLS
...
```

Skill resolution should happen in the Orchestrator, not the UI.

---

# 11. Tool and Permission Model

Skills can request tools, but the agent may only use tools allowed by its permissions.

Example:

```text
Skill requires:
- figma
- fileRead

Agent permissions:
- figma: true
- fileRead: true
- fileWrite: false

=> Skill can run
```

Invalid configuration should be detected before execution.

---

# 12. Approval Flow

Human approval is required for selected actions.

MVP approval cases:

- task result review
- dangerous/privileged operation
- transition to next workflow step if configured

Task review actions:

```text
Approve
Request Changes
Cancel
```

When changes are requested:

```text
Task
  needs_review
      ↓
Request Changes
      ↓
working
      ↓
same Agent executes revision
```

---

# 12.1 Runtime Permission Feasibility

There are two different approval layers and they must not be conflated.

### Product approval

Example:

```text
Agent completed a UI review
        ↓
Needs Review
        ↓
User approves the result
```

This is fully controlled by this product.

### Runtime/tool approval

Example:

```text
Claude/Codex requests permission to:
- execute a command
- write outside an allowed scope
- access a protected resource
```

This depends on the capabilities of the underlying Claude/Codex runtime.

The preferred runtime flow is:

```text
runtime emits structured permission request
        ↓
Orchestrator pauses run
        ↓
UI displays approval request
        ↓
user approves/rejects
        ↓
Orchestrator injects decision
        ↓
same run/session continues
```

Phase 0 must prove that this round trip is possible.

If a runtime only supports:

- interactive TTY prompts, or
- globally bypassing/auto-approving permission checks

do not fake a resumable approval architecture.

Instead, document the limitation and choose one explicit operating mode for that runtime.

Possible fallback modes:

```text
safe sandbox + pre-approved capability set
```

or:

```text
manual/local interactive mode
```

Runtime approval support must be represented as adapter capabilities rather than assumed globally.

Example:

```ts
type RuntimeCapabilities = {
  structuredEvents: boolean;
  resumableSession: boolean;
  interactiveApproval: boolean;
  cancellation: boolean;
  usageReporting: boolean;
};
```

---

# 13. Developer-specific Workspace Isolation

For code-writing agents, simultaneous modification of one repository may create conflicts.

Use Git worktree when multiple code agents work concurrently.

Example:

```text
repo/
  main/

agent-worktrees/
  frontend-agent/
  reviewer-agent/
```

However, worktree does not eliminate merge conflicts.

MVP strategy:

- avoid assigning overlapping files to multiple coding agents
- prefer sequential implementation → review
- defer automatic conflict resolution

---

# 13.1 Cancellation and Cleanup Semantics

`cancel(runId)` is not equivalent to simply killing a process.

Cancellation flow:

```text
cancel requested
    ↓
stop runtime/process
    ↓
mark AgentRun cancelled
    ↓
inspect workspace mutations
    ↓
apply configured cleanup policy
```

For coding agents, support an explicit cleanup policy:

```ts
type CancelCleanupPolicy =
  | "preserve" // keep partial work for inspection
  | "discard"; // reset the isolated worktree
```

Default MVP behavior should be `preserve` because destructive cleanup must not happen implicitly.

If an isolated Git worktree is used, `discard` may reset/remove that worktree only after the run has fully stopped.

The UI should clearly indicate that a cancelled run may contain partial artifacts.

---

# 14. Realtime Communication

Recommended:

```text
Backend → Web Client
WebSocket or SSE
```

Events:

```ts
type RealtimeEvent =
  | { type: "agent.status_changed" }
  | { type: "task.status_changed" }
  | { type: "task.result_updated" }
  | { type: "activity.created" }
  | { type: "approval.requested" };
```

Do not stream every raw model token into the pixel renderer.

Raw logs may be shown in an optional detail panel.

---

# 14.1 Execution Security Boundary

A coding agent with terminal, file-write, and network access is effectively capable of arbitrary code execution within its environment.

The MVP must explicitly choose its deployment assumption.

Initial recommended assumption:

```text
single-user / local-first trusted workspace
```

For this mode:

- restrict writable directories
- restrict working directory per run
- use runtime sandbox features when available
- require explicit permission configuration
- do not expose arbitrary remote multi-tenant execution

A hosted multi-tenant execution service is a **non-goal for the first MVP**.

Before supporting untrusted multi-user execution, introduce isolated execution environments such as per-run containers/VMs and explicit secret/network boundaries.

---

# 14.2 Usage and Cost Guardrails

Every AgentRun must have bounded execution.

Minimum guardrails:

```ts
type RunLimits = {
  maxDurationMs: number;
  maxTurns?: number;
  maxTokens?: number;
  maxEstimatedCost?: number;
};
```

Also enforce:

- workflow step limit
- retry limit
- concurrent run limit
- workspace daily/monthly budget where usage data is available

A workflow must never retry or hand off indefinitely.

When a limit is reached:

```text
AgentRun
→ stopped
→ needs_input or failed
→ user receives the reason
```

---

# 15. MVP Scope

Split validation into milestones so the second runtime and visual layer cannot block the core architecture.

## MVP-0 — Runtime + Single Agent E2E

Goal:

Prove that one real Claude **or** Codex runtime can power one custom agent through a complete product loop.

A user can:

1. Create a custom agent
2. Assign a role
3. Add at least one skill
4. Create a Task directly
5. Assign the Task to the agent
6. Run the agent
7. Observe normalized execution status
8. Receive a result
9. Approve or request changes
10. Cancel a run safely

MVP-0 does **not** require:

- the second runtime
- Pixel Office
- Input/Inbox
- multi-agent workflows
- parallel execution
- Git worktree automation

If MVP-0 works, the fundamental architecture is validated.

## MVP-1 — Dual Runtime + Daily Workspace + Pixel Visualization

Add:

- the second runtime (Claude or Codex)
- Today Todo / Working / Needs Review / Done
- basic Activity Log
- basic Pixel Office state visualization
- runtime capability differences surfaced safely

## MVP-2 — Multi-Agent Workflows

Add:

- Agent A → Agent B sequential workflow
- result/context handoff
- workflow limits
- optional Git worktree isolation for code agents

## MVP-3 — Parallel Execution

Only after sequential workflows are stable:

- concurrent AgentRuns
- concurrency limits
- parallel code worktrees
- merge/conflict handling policy

## MVP Agents

Start with two example agents:

### UI Reviewer

```text
Runtime
Claude

Skills
- UI Review
- Figma Review
```

### Frontend Developer

```text
Runtime
Codex

Skills
- React
- TypeScript
- Component Generation
```

These must be user-editable and user-creatable, not hardcoded as the product's only agent types.

---

# 16. MVP Screens

## 16.1 Today

Main dashboard.

Contains:

- Inbox count
- Today Todo
- Working tasks
- Needs Review
- Done Today
- Pixel Office

---

## 16.2 Agents

List existing agents.

Each card:

```text
UI Reviewer
Design Reviewer

Claude

Skills
Figma UI Review
Design System Check

Status
Idle
```

---

## 16.3 Agent Builder

Fields:

```text
Name
Role
Description

Runtime
- Claude
- Codex

Skills
- searchable multi-select

Permissions
- tool permissions

System Prompt
- optional advanced setting
```

Keep advanced settings collapsed by default.

---

## 16.4 Skills

Skill library.

Users can:

- browse built-in skills
- create custom skills
- edit their own skills

---

## 16.5 Task Detail

Displays:

- task description
- assignee
- current status
- execution timeline
- result
- artifacts
- logs
- approval actions

---

# 17. Suggested Project Structure

Example monorepo:

```text
apps/
  web/
  server/

packages/
  domain/
  agent-runtime/
  agent-claude/
  agent-codex/
  skills/
  realtime/
  pixel-office/
  ui/
```

Responsibilities:

```text
domain
- shared domain types
- entities
- state transitions

agent-runtime
- AgentAdapter interface
- orchestrator primitives
- event normalization

agent-claude
- Claude adapter

agent-codex
- Codex adapter

skills
- skill registry
- skill compilation

realtime
- SSE/WebSocket event definitions

pixel-office
- character rendering
- animations
- state mapping

ui
- normal application UI
```

---

# 18. Recommended Implementation Order

## Phase 0 — Runtime Feasibility Spike

This phase must happen before production UI or Pixel Office work.

Start with **one** runtime. Choose Claude or Codex based on whichever currently exposes the clearest programmable interface.

Build a minimal script/service that proves:

1. non-interactive task execution
2. structured/machine-readable events
3. tool-call observation
4. permission request observation
5. user approval/rejection can be injected programmatically
6. the same run/session continues after the decision
7. cancellation works
8. cancellation leaves workspace state in a known condition
9. failures and exit conditions are observable
10. usage/token information can be collected when exposed
11. working directory can be controlled
12. session resume behavior is understood

Required permission round trip:

```text
started
  ↓
working
  ↓
permission_requested
  ↓
orchestrator pauses
  ↓
approve / reject
  ↓
same session resumes
  ↓
completed
```

If this cannot be achieved, stop and document the runtime limitation before designing UI around it.

After the first runtime passes the spike, run the same capability matrix against the second runtime.

Phase 0 output should include:

```text
Runtime Capability Matrix

                         Claude   Codex
structured events          ?        ?
tool events                ?        ?
approval round trip        ?        ?
session resume             ?        ?
cancel                     ?        ?
usage reporting            ?        ?
working directory          ?        ?
```

Do not continue based on assumptions.

## Phase 1 — Domain + Backend

Implement only the domain required by MVP-0:

- Workspace
- Agent
- Skill
- Task
- AgentRun

Implement basic CRUD and persistence.

ActivityLog may begin as a minimal append-only normalized event record rather than a full user-facing feature.

No pixel UI yet.

---

## Phase 2 — Agent Builder

Implement:

- create/edit/delete Agent
- select Claude/Codex
- assign skills
- set permissions

---

## Phase 3 — Task Execution

Implement:

```text
Task
→ Orchestrator
→ Agent Adapter
→ Claude/Codex
→ normalized events
→ Task status update
```

Support one agent and the **first validated runtime** only.

Do not add the second runtime until the full MVP-0 loop works.

---

## Phase 4 — Second Runtime + Today Workspace

First add the second runtime behind the same adapter contract and run its capability matrix.

Then implement:

- Todo
- Working
- Needs Review
- Done Today

Task status changes must update this view in realtime.

Add Inbox/Input later; it must not block this phase.

---

## Phase 5 — Pixel Office

Start very small.

First version:

- one room
- one desk per agent
- idle animation
- working animation
- needs review animation
- blocked animation

Do not build free movement/pathfinding initially unless required.

---

## Phase 6 — Approval

Implement:

```text
needs_review
→ approve
→ done
```

and:

```text
needs_review
→ request changes
→ working
```

---

## Phase 7 — Multi-Agent Workflow

Implement only sequential workflow first.

Example:

```text
UI Reviewer
→ Frontend Developer
→ Code Reviewer
```

On completion:

```text
Agent A result
    ↓
Task context
    ↓
Agent B
```

After the basic handoff is stable, add Skill-bound step contracts:

- select one or more Skills per step
- define the step instruction and expected handoff
- optionally restrict file modification per step
- include only the relevant step scope in the runtime prompt
- save and reuse the complete sequence as a workflow preset
- allow Task-specific overrides without mutating the saved preset

---

## Phase 8 — Parallel Execution

After sequential workflows are stable:

- multiple AgentRuns
- independent process lifecycle
- concurrency limits
- Git worktree isolation for coding agents

---

# 19. Explicit Non-Goals for MVP

Do NOT build these initially:

- complex workflow DAG editor
- autonomous agent-to-agent conversation loops
- automatic merge conflict resolution
- marketplace
- many LLM providers
- arbitrary plugin ecosystem
- full multiplayer office
- advanced pixel character customization
- automatic organization-wide task planning
- perfect inference of "thinking" vs "coding"
- fully autonomous approvals
- hosted multi-tenant arbitrary code execution
- unbounded agent runs or workflow retries

---

# 20. Main Technical Risks

## Risk 1 — Claude/Codex event interfaces

The exact streaming/event interface may vary by CLI version.

Mitigation:

- verify current CLI capabilities first
- prefer structured machine-readable output
- isolate all parsing inside adapters

---

## Risk 2 — Permission prompts

An agent can appear stuck if runtime permission requests are not handled.

Mitigation:

Treat permission requests as first-class events.

```text
runtime permission request
        ↓
needs_input / needs_approval
        ↓
user decision
        ↓
resume agent
```

---

## Risk 3 — Misleading UI state

Do not pretend the system knows exactly what the model is "thinking".

Only display states supported by observable runtime behavior.

Prefer:

```text
Working
Using terminal
Waiting for approval
Review ready
```

over fictional internal states.

---

## Risk 4 — Concurrent code modification

Worktrees isolate directories but do not solve semantic/merge conflicts.

MVP:

Prefer sequential code workflows.

---

## Risk 5 — Pixel UI consuming too much development time

The visual layer is not the core technical risk.

Build:

```text
runtime
→ normalized events
→ tasks
→ realtime
```

first.

Then add pixel visualization.

---

## Risk 6 — Persistence/log growth

Raw model/tool streams can become very large.

Mitigation:

- keep product state normalized in DB
- store raw runtime logs separately
- enforce retention/size limits

---

## Risk 7 — Cancellation leaves partial work

A killed process may leave modified files or incomplete artifacts.

Mitigation:

- cancellation has an explicit cleanup policy
- preserve partial work by default
- destructive reset must be explicit

---

## Risk 8 — Execution security

Terminal + file write + network access creates a powerful execution boundary.

Mitigation:

- MVP is local-first/single-user trusted execution
- restrict writable paths and permissions
- defer hosted multi-tenant execution until isolated sandboxes exist

---

## Risk 9 — Cost/runaway workflows

Retries or agent handoffs can silently consume excessive tokens/time.

Mitigation:

- run duration/token/cost limits
- retry and workflow step limits
- concurrency limits
- stop on budget exhaustion

---

# 21. Initial Success Scenario

The first end-to-end product scenario is intentionally non-pixel and single-runtime:

```text
1. User opens the workspace.

2. User creates:

   Agent:
   UI Reviewer

   Runtime:
   first validated runtime

   Skills:
   UI Review

3. User creates a Task directly:

   "Review the checkout screen spacing."

4. User assigns the UI Reviewer.

5. User presses Run.

6. AgentRun changes to running.

7. Runtime events are normalized.

8. If runtime permission is requested:
   - the request is surfaced
   - user approves/rejects
   - the same run continues

9. Result is generated.

10. Task changes to Needs Review.

11. User approves or requests changes.

12. Approved task moves to Done.

13. User can inspect normalized execution history.

14. A second run can be cancelled without leaving the system in an unknown state.
```

If this works with one real runtime, the core architecture is validated.

Pixel Office, Today dashboard, Input/Inbox, the second runtime, and multi-agent workflows build on top of this proof.

---

# 22. Definition of Done

## MVP-0

The core MVP is done when:

- [ ] at least one Claude/Codex runtime adapter passes Phase 0
- [ ] structured runtime events can be normalized
- [ ] permission request → user decision → same-session continuation is proven, or the runtime limitation is explicitly documented with a safe fallback mode
- [ ] user can create an Agent
- [ ] user can assign Skills
- [ ] user can create a Task directly
- [ ] Task can be assigned to the Agent
- [ ] Task can be executed
- [ ] execution status updates in realtime
- [ ] execution result is persisted
- [ ] user can approve result
- [ ] user can request changes
- [ ] user can cancel a run
- [ ] cancellation cleanup behavior is deterministic
- [ ] run duration/retry/cost guardrails exist
- [ ] raw runtime logs are bounded and stored separately from primary product state

## MVP-1

- [ ] second runtime adapter works
- [ ] Today dashboard reflects Task state
- [ ] basic Activity Log is visible
- [ ] Pixel Office reflects normalized state
- [ ] runtime capability differences are handled safely

## MVP-2

- [ ] sequential Agent A → Agent B workflow works
- [ ] workflow step/retry limits exist
- [ ] result/context handoff is persisted
- [ ] each workflow step has an explicit instruction and expected handoff
- [ ] each workflow step can select the Skills used for that stage
- [ ] step permissions can restrict, but never expand, Agent permissions
- [ ] workflow presets persist agents, Skills, instructions, handoffs, and permission restrictions
- [ ] Task-specific workflow edits do not mutate the reusable preset
- [ ] code-agent isolation strategy is implemented where needed

---

# 23. First Engineering Task

Before creating production UI, implement the runtime feasibility spike.

Suggested structure:

```text
scripts/runtime-spike/
  capabilities.ts
  normalize-event.ts
  permission-roundtrip.ts
  cancel.ts

  claude.ts
  codex.ts
```

Do **not** implement both adapters fully at once.

First choose one runtime and prove:

```text
[UI Reviewer] started
[UI Reviewer] working
[UI Reviewer] tool_started: ...
[UI Reviewer] permission_requested: ...
[User] approved
[UI Reviewer] resumed
[UI Reviewer] completed
```

Also prove:

```text
[UI Reviewer] started
[User] cancel
[UI Reviewer] cancelled
[Workspace] partial work preserved or explicitly discarded
```

Record the result in a capability matrix before moving to application architecture.

Only after the first runtime works end-to-end should the second runtime be integrated.

---

# 24. Product Positioning

The core concept is:

> A local agent workspace where people map reusable skills to AI teammates, assign real project work, and review how those capabilities collaborate.

The pixel office is the visualization layer.

Claude and Codex are the execution engines.

The product is not primarily an AI character collection or a virtual organization chart. Many pixel-office products create separate agents around fixed positions such as developer, designer, and reviewer. AI Pixel Office should instead treat an agent as a reusable execution identity whose capabilities can be assembled through skills.

```text
Fixed-position approach
  Frontend Agent
  Reviewer Agent
  Tester Agent

AI Pixel Office
  Reusable Agent
    +-- Frontend Implementation Skill
    +-- Code Review Skill
    +-- Test and Validation Skill
```

This enables:

- reusing one agent across different kinds of work
- specializing the same runtime through different skill mappings
- making capabilities explicit instead of hiding them behind job titles
- selecting the appropriate capability at each workflow step
- combining skills with project instructions such as `AGENTS.md` and `CLAUDE.md`
- evolving toward shareable, versioned, importable skill packages

The product promise is:

> Build an AI team by composing capabilities, not by repeatedly creating fixed job titles.

The UI must make this differentiator visible. Agent cards, the Agent Builder, task assignment, and workflow steps should emphasize:

- which skills an agent owns
- which skills will be used for the current task or step
- the permissions and project context available to those skills
- which skill produced each stage result
- whether a required capability is missing before execution

Runtime badges such as Claude or Codex remain useful operational metadata, but they must not visually overpower the agent's mapped skills and purpose.

The primary product abstraction is:

```text
Workspace
  ↓
Agents
  ↓
Mapped Skills
  ↓
Tasks
  ↓
Skill-bound Workflow Steps / Runs
  ↓
Results / Approvals
```

Keep this hierarchy intact throughout implementation.
