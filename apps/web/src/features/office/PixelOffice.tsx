import { mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Application, Container, Graphics, Text, type Ticker } from "pixi.js";
import styled, { keyframes } from "styled-components";
import { Button, Input, Popover } from "@ai-pixel-office/design-system";
import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { RUNTIME } from "../../shared/config/presentation.ts";
import { getPet, plotPet } from "@ai-pixel-office/pet";
import { OfficeCanvasStyles } from "./officeCanvasStyles.ts";

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

const agentFloat = keyframes`
  from {
    transform: translateY(-1px);
  }
  to {
    transform: translateY(1px);
  }
`;

const Office = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 760 / 420;
  overflow: hidden;
  background: #ead8bd;
  border: 3px solid ${({ theme }) => theme.colors.border.strong};
  box-shadow: inset 0 0 0 3px #f8e9ce;
  line-height: 0;
`;

const Stage = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, #f2dfbf 0 30%, #9f6d4e 30% 32%, #d6aa76 32% 100%);
`;

const BootState = styled.div<{ $hidden: boolean; $error: boolean }>`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.floating};
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: #6f5c4c;
  background: linear-gradient(to bottom, #f2dfbf 0 30%, #9f6d4e 30% 32%, #d6aa76 32% 100%);
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  line-height: 1.4;
  line-height: 1.4;
  pointer-events: none;
  opacity: ${({ $hidden }) => ($hidden ? 0 : 1)};
  visibility: ${({ $hidden }) => ($hidden ? "hidden" : "visible")};
  transition:
    opacity 0.16s ease-out,
    visibility 0s linear ${({ $hidden }) => ($hidden ? "0.16s" : "0s")};

  > span {
    width: 42px;
    padding: 8px 0;
    border: 2px solid ${({ theme }) => theme.colors.border.strong};
    background: #f8e9ce;
    box-shadow: 3px 3px 0 #9f6d4e;
    color: ${({ $error }) => ($error ? "#9b403d" : "#4e8874")};
    text-align: center;
    letter-spacing: 3px;
  }
`;

const LabelLayer = styled.div<{ $ready: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  line-height: 1.2;
  opacity: ${({ $ready }) => ($ready ? 1 : 0)};
  transition: opacity 0.16s ease-out;
`;

const StatusLabel = styled.span<{ $hidden: boolean }>`
  position: absolute;
  left: -16.5%;
  top: 0;
  width: 133%;
  height: 27%;
  padding: 0 5%;
  border: 2px solid #748c83;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.background.surface};
  display: grid;
  place-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: clamp(5px, 0.82vw, 10px);
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;

  ${({ $hidden }) =>
    $hidden &&
    `
      opacity: 0;
      transform: translateY(4px) scale(0.96);
    `}

  @media ${mediaQuery.reducedMotion} {
    animation: none;
  }
`;

const AgentName = styled.button<{ $hasTask: boolean }>`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.raised};
  left: 3%;
  bottom: -9%;
  width: 94%;
  min-height: 23%;
  padding: 2% 4%;
  border: 1px solid rgb(109 83 71 / 42%);
  border-radius: ${({ theme }) => theme.radius.sm};
  background: rgb(255 250 240 / 88%);
  box-shadow: 0 2px 0 rgb(109 83 71 / 30%);
  display: grid;
  place-content: center;
  color: #4b4541;
  font: inherit;
  line-height: 1.05;
  pointer-events: auto;
  cursor: pointer;

  strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: clamp(6px, 1vw, 12px);
  }

  small {
    margin-top: 4px;
    color: #6f786e;
    font-size: clamp(4px, 0.62vw, 7px);
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  ${({ $hasTask }) =>
    $hasTask &&
    `
      border-color: #628275;
      background: rgb(239 248 240 / 94%);
    `}

  &:focus-visible {
    outline: 2px dashed #426e60;
    outline-offset: 2px;
  }
`;

const RuntimeChip = styled.span`
  position: absolute;
  top: -22%;
  right: -8%;
  z-index: ${({ theme }) => theme.zIndex.floating};
  padding: 4px 4px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: #fff;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: clamp(5px, 0.6vw, ${({ theme }) => theme.typography.fontSize.xs});
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  letter-spacing: 0.02em;
  white-space: nowrap;
  box-shadow: 0 1px 0 rgb(0 0 0 / 25%);
`;

const AgentHitbox = styled.button`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.content};
  left: 12%;
  top: 28%;
  width: 76%;
  height: 81%;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: transparent;
  pointer-events: auto;
  cursor: pointer;

  &:focus-visible {
    outline: 2px dashed #426e60;
    outline-offset: 2px;
  }
`;

const AgentSlot = styled.div`
  position: absolute;
  width: 16.05%;
  color: #4b4541;
  text-align: center;
  font-family: Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  animation: ${agentFloat} 1.5s ease-in-out infinite alternate;
  pointer-events: none;

  @media ${mediaQuery.reducedMotion} {
    animation: none;
  }

  &:hover ${AgentName}, &:focus-within ${AgentName} {
    border-color: #426e60;
  }

  &[data-status="needs_review"]
    ${AgentName},
    &[data-status="needs_input"]
    ${AgentName},
    &[data-status="blocked"]
    ${AgentName},
    &[data-status="failed"]
    ${AgentName} {
    border-color: #8b68b5;
    box-shadow: 0 2px 0 rgb(92 66 123 / 42%);
  }
`;

const EmptyLabel = styled.div`
  position: absolute;
  left: 50%;
  top: 59%;
  transform: translate(-50%, -50%);
  color: #705b4e;
  font-size: clamp(11px, 1.6vw, 18px);
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;

const QuickPopover = styled(Popover)`
  z-index: ${({ theme }) => theme.zIndex.popover};
  width: min(320px, calc(100vw - 24px));
  padding: 16px;
  border: 2px solid #5a766c;
  background: ${({ theme }) => theme.colors.background.surface};
  box-shadow: 5px 5px 0 #9eafa6;

  small {
    color: #7d6f65;
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  }

  form {
    display: grid;
    gap: 8px;
  }

  label {
    color: #796b60;
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    display: grid;
    gap: 4px;
  }
`;

const PopoverHeading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const TaskListPopover = styled.div`
  display: grid;
  gap: 4px;
  max-height: 180px;
  margin-bottom: 12px;
  overflow: auto;

  button {
    min-width: 0;
    padding: 8px;
    border: 1px solid #d5c8b5;
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    color: #4b4541;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: #4c7b6b;
      background: #eaf2ec;
      outline: none;
    }

    > span,
    > small {
      color: #756960;
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    > strong {
      overflow: hidden;
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;

const Styled = {
  Office,
  Stage,
  BootState,
  LabelLayer,
  AgentSlot,
  StatusLabel,
  AgentName,
  RuntimeChip,
  AgentHitbox,
  EmptyLabel,
  QuickPopover,
  PopoverHeading,
  TaskList: TaskListPopover,
};

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
    <Styled.Office
      data-canvas-state={canvasState}
      style={{ aspectRatio: `${OFFICE_WIDTH} / ${roomHeight}` }}
      aria-label={`${agents.length}명의 에이전트가 있는 픽셀 오피스`}
    >
      <OfficeCanvasStyles />
      <Styled.Stage ref={host} />
      <Styled.BootState
        $hidden={canvasState === "ready"}
        $error={canvasState === "error"}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">{canvasState === "error" ? "!" : "···"}</span>
        {canvasState === "error"
          ? "픽셀 오피스를 불러오지 못했습니다."
          : "픽셀 오피스를 준비하는 중..."}
      </Styled.BootState>
      <Styled.LabelLayer $ready={canvasState === "ready"}>
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
          <Styled.EmptyLabel>첫 번째 AI 동료를 만들어 주세요!</Styled.EmptyLabel>
        )}
      </Styled.LabelLayer>
    </Styled.Office>
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
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
      <Styled.RuntimeChip data-model={agent.model} style={{ background: runtime.color }}>
        {runtime.label}
      </Styled.RuntimeChip>
      <strong>{agent.name}</strong>
      <small>{tasks.length > 0 ? `작업 ${tasks.length}개 보기` : "바로 맡기기 +"}</small>
    </>
  );
  const bubble = (
    <Styled.StatusLabel $hidden={!message} aria-hidden={!message}>
      {message ?? "대화 없음"}
    </Styled.StatusLabel>
  );

  return (
    <Styled.AgentSlot style={{ left, top, height }} data-status={status}>
      {bubble}
      <Styled.AgentName
        ref={triggerRef}
        type="button"
        $hasTask={tasks.length > 0}
        aria-expanded={open}
        aria-controls={popoverId}
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
      >
        {labelContents}
      </Styled.AgentName>
      <Styled.AgentHitbox
        type="button"
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
      <Styled.QuickPopover
        id={popoverId}
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        side="top"
        sideOffset={10}
        collisionPadding={16}
      >
        <Styled.PopoverHeading>
          <small>{tasks.length > 0 ? `진행할 작업 ${tasks.length}개` : "바로 맡기기"}</small>
          <strong>{agent.name}</strong>
        </Styled.PopoverHeading>
        {tasks.length > 0 && (
          <Styled.TaskList>
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
          </Styled.TaskList>
        )}
        <form onSubmit={submit}>
          <label>
            할 일
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 화면 문구 검토"
              autoFocus
            />
          </label>
          <label>
            원하는 결과 · 선택
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="비워도 괜찮아요"
            />
          </label>
          <Button $variant="primary" disabled={!title.trim()}>
            작업 만들기
          </Button>
        </form>
      </Styled.QuickPopover>
    </Styled.AgentSlot>
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
