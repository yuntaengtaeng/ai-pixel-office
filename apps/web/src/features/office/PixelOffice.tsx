import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Application, Container, Graphics, Text, type Ticker } from "pixi.js";
import { Popover } from "radix-ui";
import type { Agent, Task, TaskStatus } from "../../../../../packages/domain/src/entities.ts";
import { RUNTIME } from "../../shared/config/presentation.ts";
import { getPet, plotPet } from "./pets.ts";

const OFFICE_WIDTH = 760;
const COLUMN_X = [68, 244, 420, 596] as const;
const FIRST_ROW_Y = 188;
const ROW_GAP = 142;

function officeLayout(agentCount: number): { positions: Array<[number, number]>; height: number } {
  const slotCount = Math.max(4, Math.ceil(agentCount / COLUMN_X.length) * COLUMN_X.length);
  const positions = Array.from({ length: slotCount }, (_, index) => [
    COLUMN_X[index % COLUMN_X.length]!,
    FIRST_ROW_Y + Math.floor(index / COLUMN_X.length) * ROW_GAP,
  ]) as Array<[number, number]>;
  const rows = slotCount / COLUMN_X.length;
  return { positions, height: Math.max(420, 278 + rows * ROW_GAP) };
}

const STATUS_LABEL: Record<TaskStatus | "idle", string> = {
  idle: "쉬는 중",
  todo: "준비 중",
  working: "작업 중",
  needs_review: "검토 부탁!",
  needs_input: "질문 있어요",
  blocked: "막혔어요",
  done: "완료!",
  failed: "문제 발생",
};

const IDLE_MESSAGES = [
  "커피 한 모금 마시는 중",
  "기지개를 쭉 켜는 중",
  "창밖을 잠깐 보는 중",
  "새 작업을 기다리는 중",
  "동료에게 인사하는 중",
];

function hash(value: string): number {
  return [...value].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) | 0, 0);
}

function petGraphic(agent: Agent): Container {
  const pet = getPet(agent.avatarId, hash(agent.id));
  const character = new Container();
  const pixels = new Graphics();
  const scale = 3;
  plotPet(pet, (x, y, width, height, color) => {
    pixels.rect(x * scale, y * scale, width * scale, height * scale).fill(color);
  });
  character.addChild(pixels);
  return character;
}

function roomBackground(height: number): Container {
  const room = new Container();
  const wall = new Graphics().rect(0, 0, 760, 126).fill("#f2dfbf");
  const trim = new Graphics().rect(0, 122, 760, 8).fill("#9f6d4e");
  const floor = new Graphics().rect(0, 130, 760, height - 130).fill("#d6aa76");
  for (let y = 130; y < height; y += 32) {
    for (let x = (Math.floor(y / 32) % 2) * -32; x < 760; x += 64) {
      floor.rect(x, y, 31, 31).fill("#dfb782");
    }
  }
  const windowFrame = new Graphics()
    .roundRect(46, 24, 170, 76, 4)
    .fill("#6f4c42")
    .rect(53, 31, 156, 62)
    .fill("#9bd3d6")
    .rect(128, 31, 6, 62)
    .fill("#f6e7ce")
    .rect(53, 60, 156, 6)
    .fill("#f6e7ce");
  const board = new Graphics()
    .roundRect(508, 24, 190, 76, 4)
    .fill("#b17856")
    .rect(516, 32, 174, 60)
    .fill("#f4ead5");
  const title = new Text({
    text: "AI PIXEL OFFICE",
    style: { fontFamily: "monospace", fontSize: 17, fontWeight: "700", fill: "#5b4b42" },
  });
  title.position.set(531, 51);
  const rug = new Graphics()
    .roundRect(276, 139, 208, 24, 7)
    .fill("#bc695b")
    .rect(288, 146, 184, 4)
    .fill("#e5b56e");
  const plant = new Graphics()
    .rect(719, 86, 7, 42)
    .fill("#78543e")
    .rect(707, 109, 31, 20)
    .fill("#b66d48")
    .rect(711, 72, 9, 33)
    .fill("#568362")
    .rect(725, 65, 9, 40)
    .fill("#65976c")
    .rect(718, 57, 8, 49)
    .fill("#76a978");
  const lights = new Graphics();
  const lightCount = 4;
  const lightGap = 760 / lightCount;
  for (let index = 0; index < lightCount; index += 1) {
    const cx = lightGap * index + lightGap / 2;
    lights
      .roundRect(cx - 21, 6, 42, 9, 3)
      .fill("#f6ecd0")
      .roundRect(cx - 21, 6, 42, 9, 3)
      .stroke({ width: 1, color: "#c9a15c" });
  }
  const clock = new Graphics()
    .circle(362, 62, 22)
    .fill("#f6ecd9")
    .circle(362, 62, 22)
    .stroke({ width: 3, color: "#6f4c42" })
    .rect(360, 46, 3, 17)
    .fill("#4b3b32")
    .rect(362, 60, 14, 3)
    .fill("#4b3b32")
    .circle(362, 62, 2)
    .fill("#4b3b32");
  const cabinet = new Graphics()
    .rect(226, 70, 34, 60)
    .fill("#8a6a4c")
    .rect(230, 76, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 88, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 100, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 112, 26, 3)
    .fill("#e8d7ba");
  room.addChild(wall, lights, trim, floor, windowFrame, board, clock, cabinet, rug, plant, title);
  return room;
}

function desk(x: number, y: number, model?: Agent["model"]): Container {
  const item = new Container();
  const screenColor = model ? RUNTIME[model].color : "#a9d7ce";
  const shape = new Graphics()
    .rect(-11, -30, 8, 72)
    .fill("#c7bda9")
    .rect(-11, -30, 8, 4)
    .fill("#a7987d")
    .rect(127, -30, 8, 72)
    .fill("#c7bda9")
    .rect(127, -30, 8, 4)
    .fill("#a7987d")
    .roundRect(0, 0, 124, 42, 5)
    .fill("#9b6849")
    .rect(8, 38, 9, 44)
    .fill("#6c493c")
    .rect(107, 38, 9, 44)
    .fill("#6c493c")
    .rect(40, -23, 46, 28)
    .fill("#4e5965")
    .rect(45, -18, 36, 18)
    .fill(screenColor)
    .rect(60, 5, 7, 10)
    .fill("#59636c");
  if (model) drawMonitorGlyph(shape, model);
  item.addChild(shape);
  item.position.set(x, y);
  return item;
}

function drawMonitorGlyph(graphics: Graphics, model: Agent["model"]): void {
  const points =
    model === "codex"
      ? [
          [1, 0],
          [2, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 4],
          [2, 4],
        ]
      : [
          [1, 0],
          [0, 1],
          [2, 1],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 3],
          [2, 3],
          [0, 4],
          [2, 4],
        ];
  for (const [px, py] of points) graphics.rect(59 + px! * 4, -16 + py! * 3, 4, 3).fill("#fffaf0");
}

export function PixelOffice({
  agents,
  tasks,
  onQuickAssign,
  onOpenTask,
}: {
  agents: Agent[];
  tasks: Task[];
  onQuickAssign?: (agentId: string, title: string, description?: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [canvasState, setCanvasState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const { positions, height: roomHeight } = useMemo(
    () => officeLayout(agents.length),
    [agents.length],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let application: Application | undefined;
    let animation: ((ticker: Ticker) => void) | undefined;

    void (async () => {
      const app = new Application();
      try {
        await app.init({
          width: OFFICE_WIDTH,
          height: roomHeight,
          antialias: false,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          backgroundColor: "#ead8bd",
        });
      } catch (error) {
        if (!disposed) {
          setCanvasState("error");
          console.error("Pixel Office를 시작하지 못했습니다.", error);
        }
        return;
      }
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      application = app;
      app.canvas.className = "office-canvas";
      app.stage.addChild(roomBackground(roomHeight));

      positions.forEach(([x, y], index) => app.stage.addChild(desk(x, y, agents[index]?.model)));

      const animated: Array<{
        item: Container;
        baseX: number;
        baseY: number;
        status: TaskStatus | "idle";
        phase: number;
      }> = [];
      agents.forEach((agent, index) => {
        const [deskX, deskY] = positions[index]!;
        const { status } = agentOfficeState(agent, tasks);
        const item = new Container();
        const pet = petGraphic(agent);
        pet.position.set(37, -4);
        item.addChild(pet);
        item.position.set(deskX!, deskY! - 70);
        app.stage.addChild(item);
        animated.push({ item, baseX: item.x, baseY: item.y, status, phase: index * 0.7 });
      });

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      animation = (ticker) => {
        if (reduceMotion) return;
        const time = performance.now() / 350;
        for (const character of animated) {
          const wave = Math.sin(time + character.phase);
          character.item.x = character.baseX;
          character.item.rotation = 0;
          if (character.status === "working") {
            character.item.x += Math.round(Math.sin(time * 3 + character.phase));
            character.item.y = character.baseY + Math.round(wave * 1.4);
          } else if (character.status === "done") {
            character.item.y = character.baseY + Math.round(Math.abs(wave) * -5);
            character.item.rotation =
              Math.sin(time * 1.8 + character.phase) * 0.02 * ticker.deltaTime;
          } else if (character.status === "blocked" || character.status === "failed") {
            character.item.y = character.baseY + 3 + Math.round(wave * 0.5);
            character.item.rotation = -0.025;
          } else if (character.status === "needs_review" || character.status === "needs_input") {
            character.item.y = character.baseY + Math.round(Math.abs(wave) * -3);
          } else if (character.status === "idle") {
            character.item.x += Math.round(Math.sin(time * 0.24 + character.phase) * 7);
            character.item.y = character.baseY + Math.round(Math.abs(wave) * -1.5);
          } else {
            character.item.y = character.baseY + Math.round(wave);
          }
        }
      };
      app.ticker.add(animation);
      app.render();
      element.replaceChildren(app.canvas);
      setCanvasState("ready");
    })();

    return () => {
      disposed = true;
      if (application) {
        if (animation) application.ticker.remove(animation);
        application.stop();
        application.destroy(true, { children: true });
      }
      element.replaceChildren();
    };
  }, [agents, positions, roomHeight, tasks]);

  const labels = agents.map((agent, index) => {
    const { latestTask, status } = agentOfficeState(agent, tasks);
    const agentTasks = tasks.filter(
      (task) => task.assigneeAgentId === agent.id && task.status !== "done",
    );
    const recentlyDone =
      latestTask?.status === "done" && now - new Date(latestTask.updatedAt).getTime() < 15_000;
    const cycleSecond = Math.floor(now / 1_000) + (Math.abs(hash(agent.id)) % 13);
    const idleMessageVisible = cycleSecond % 18 < 5;
    const workingMessageVisible = cycleSecond % 13 < 3;
    const message = recentlyDone
      ? "방금 작업을 마쳤어요!"
      : status === "idle" && idleMessageVisible
        ? IDLE_MESSAGES[Math.floor(cycleSecond / 18) % IDLE_MESSAGES.length]!
        : status === "done" && idleMessageVisible
          ? "다음 일을 기다리는 중"
          : status === "working" && !workingMessageVisible
            ? undefined
            : status === "todo"
              ? "시작을 기다리고 있어요."
              : status === "idle"
                ? undefined
                : STATUS_LABEL[status];
    const [x, y] = positions[index]!;
    return {
      agent,
      message,
      tasks: agentTasks,
      status,
      left: `${(x / OFFICE_WIDTH) * 100}%`,
      top: `${((y - 105) / roomHeight) * 100}%`,
    };
  });
  return (
    <div
      className="pixel-office"
      data-canvas-state={canvasState}
      style={{ aspectRatio: `${OFFICE_WIDTH} / ${roomHeight}` }}
      aria-label={`${agents.length}명의 에이전트가 있는 픽셀 오피스`}
    >
      <div ref={host} className="office-stage" />
      <div
        className={`office-boot-state ${canvasState === "ready" ? "is-hidden" : ""} ${
          canvasState === "error" ? "is-error" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">{canvasState === "error" ? "!" : "···"}</span>
        {canvasState === "error"
          ? "픽셀 오피스를 불러오지 못했습니다."
          : "픽셀 오피스를 준비하는 중..."}
      </div>
      <div className="office-label-layer">
        {labels.map(({ agent, message, tasks: agentTasks, status, left, top }) => (
          <AgentQuickAssign
            key={agent.id}
            agent={agent}
            message={message}
            tasks={agentTasks}
            status={status}
            left={left}
            top={top}
            height={`${(105 / roomHeight) * 100}%`}
            onAssign={onQuickAssign}
            onOpenTask={onOpenTask}
          />
        ))}
        {agents.length === 0 && (
          <div className="office-empty-label">첫 번째 AI 동료를 만들어 주세요!</div>
        )}
      </div>
    </div>
  );
}

function AgentQuickAssign({
  agent,
  message,
  tasks,
  status,
  left,
  top,
  height,
  onAssign,
  onOpenTask,
}: {
  agent: Agent;
  message?: string;
  tasks: Task[];
  status: TaskStatus | "idle";
  left: string;
  top: string;
  height: string;
  onAssign?: (agentId: string, title: string, description?: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !onAssign) return;
    onAssign(agent.id, title.trim(), description.trim() || undefined);
    setTitle("");
    setDescription("");
    setOpen(false);
  };
  const runtime = RUNTIME[agent.model];
  const labelContents = (
    <>
      <span
        className="office-runtime-chip"
        data-model={agent.model}
        style={{ background: runtime.color }}
      >
        {runtime.label}
      </span>
      <strong>{agent.name}</strong>
      <small>{tasks.length > 0 ? `작업 ${tasks.length}개 보기` : "바로 맡기기 +"}</small>
    </>
  );
  const bubble = (
    <span className={`office-status-label${message ? "" : " is-hidden"}`} aria-hidden={!message}>
      {message ?? "대화 없음"}
    </span>
  );

  return (
    <div className="office-agent-slot" style={{ left, top, height }} data-status={status}>
      {bubble}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`office-agent-name${tasks.length > 0 ? " has-task" : ""}`}
            title={
              tasks.length > 0
                ? `${agent.name}의 작업 목록 열기`
                : `${agent.name}에게 바로 작업 맡기기`
            }
            aria-label={
              tasks.length > 0
                ? `${agent.name}의 작업 목록 열기`
                : `${agent.name}에게 바로 작업 맡기기`
            }
          >
            {labelContents}
          </button>
        </Popover.Trigger>
        <button
          type="button"
          className="office-agent-hitbox"
          title={
            tasks.length > 0
              ? `${agent.name}의 작업 목록 열기`
              : `${agent.name}에게 바로 작업 맡기기`
          }
          aria-label={
            tasks.length > 0
              ? `${agent.name}의 작업 목록 열기`
              : `${agent.name}에게 바로 작업 맡기기`
          }
          onClick={() => setOpen(true)}
        />
        <Popover.Portal>
          <Popover.Content
            className="office-quick-popover"
            side="top"
            align="center"
            sideOffset={10}
            collisionPadding={16}
          >
            <div className="office-popover-heading">
              <small>{tasks.length > 0 ? `진행할 작업 ${tasks.length}개` : "바로 맡기기"}</small>
              <strong>{agent.name}</strong>
            </div>
            {tasks.length > 0 && (
              <div className="office-task-list">
                {tasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => {
                      setOpen(false);
                      onOpenTask?.(task.id);
                    }}
                  >
                    <span>{STATUS_LABEL[task.status]}</span>
                    <strong>{task.title}</strong>
                    <small>열기 →</small>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit}>
              <label>
                할 일
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 화면 문구 검토"
                  autoFocus
                />
              </label>
              <label>
                원하는 결과 · 선택
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="비워도 괜찮아요"
                />
              </label>
              <button className="primary-button" disabled={!title.trim()}>
                작업 만들기
              </button>
            </form>
            <Popover.Arrow className="office-popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function agentOfficeState(
  agent: Agent,
  tasks: Task[],
): { latestTask?: Task; task?: Task; status: TaskStatus | "idle" } {
  const activeTask = tasks.find(
    (task) => task.assigneeAgentId === agent.id && task.status !== "done",
  );
  const latestTask = activeTask ?? tasks.find((task) => task.assigneeAgentId === agent.id);
  return { latestTask, task: activeTask, status: activeTask?.status ?? "idle" };
}
