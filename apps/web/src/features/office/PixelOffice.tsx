import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, type Texture, type Ticker } from "pixi.js";
import styled from "styled-components";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { getPet, getPetSpriteUrl } from "@ai-pixel-office/pet";
import { OfficeCanvasStyles } from "./components/OfficeCanvasStyles.ts";
import { AgentQuickAssign } from "./components/AgentQuickAssign.tsx";
import { OFFICE_STATUS_LABEL, petMessage } from "./utils/pet-personality.ts";
import { animatePet, type AnimatedPet } from "./utils/pet-animation.ts";
import {
  agentOfficeState,
  OFFICE_STATUS_GROUP_META,
  officeStatusGroup,
} from "./utils/agentOfficeState.ts";
import { OFFICE_PALETTE } from "./utils/officePalette.ts";
import { desk, hash, petGraphic, roomBackground } from "./utils/canvasScene.ts";
import { OFFICE_WIDTH, officeFloorPlan, planSeats, type Point } from "./utils/officeFloorPlan.ts";
import { corridorPath, startWalk } from "./utils/petWalk.ts";
import { loadCanvasFonts } from "./utils/canvasFonts.ts";

/** 캔버스 내부 해상도 배율 (화면에 맞춰 줄여도 글자 획이 남는 최소 2배) */
const MIN_RENDER_RESOLUTION = 2;
const MAX_RENDER_RESOLUTION = 3;
/** 자리 좌표에서 펫을 그리는 위치까지 올라가는 거리 */
const PET_RISE_FROM_SEAT = 70;

const Office = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 760 / 420;
  overflow: hidden;
  background: ${OFFICE_PALETTE.floor};
  border: 1px solid ${({ theme }) => theme.colors.border.strong};
  line-height: 0;
`;

const Stage = styled.div`
  position: absolute;
  inset: 0;
  background: ${OFFICE_PALETTE.floor};
`;

const BootState = styled.div<{ $hidden: boolean; $error: boolean }>`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.floating};
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x3};
  color: ${OFFICE_PALETTE.label};
  background: ${OFFICE_PALETTE.floor};
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
    padding: ${({ theme }) => `${theme.space.x2} 0`};
    border: 1px solid ${({ theme }) => theme.colors.border.strong};
    background: ${OFFICE_PALETTE.furniture};
    box-shadow: 0 0 0 1px ${OFFICE_PALETTE.furnitureLine};
    color: ${({ $error }) => ($error ? OFFICE_PALETTE.error : OFFICE_PALETTE.working)};
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

const EmptyLabel = styled.div`
  position: absolute;
  left: 50%;
  top: 59%;
  transform: translate(-50%, -50%);
  color: ${OFFICE_PALETTE.label};
  font-size: clamp(11px, 1.6vw, 18px);
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;

const AccessibleList = styled.details`
  margin-top: ${({ theme }) => theme.space.x3};

  summary {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    cursor: pointer;
  }

  ul {
    list-style: none;
    margin: ${({ theme }) => theme.space.x2} 0 0;
    padding: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
  }

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x2} 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};

    &:last-child {
      border-bottom: 0;
    }

    small {
      overflow: hidden;
      min-width: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;

const AccessibleDot = styled.span`
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radius.circle};
  display: inline-block;
`;

const Styled = {
  Office,
  Stage,
  BootState,
  LabelLayer,
  EmptyLabel,
  AccessibleList,
  AccessibleDot,
};

type WalkingLabel = { element: HTMLElement; pet: AnimatedPet; target: Point };

/** 걷는 동안 이름표를 펫 위치에 맞춰 옮기고, 도착한 펫의 이름표는 제자리로 돌림 */
function followWalkingPets(labels: WalkingLabel[], scale: number): void {
  for (let index = labels.length - 1; index >= 0; index -= 1) {
    const { element, pet, target } = labels[index]!;
    if (pet.walk) {
      element.style.translate = `${(pet.baseX - target.x) * scale}px ${(pet.baseY - target.y) * scale}px`;
      continue;
    }
    element.style.translate = "";
    labels.splice(index, 1);
  }
}

export function PixelOffice({
  agents,
  tasks,
  onQuickAssign,
  onOpenTask,
  deskLabels = {},
}: {
  agents: Agent[];
  tasks: Task[];
  /** 내 자리로 온 동료가 들고 있는 서류 이름 (동료 id별) */
  deskLabels?: Record<string, string>;
  onQuickAssign?: (
    agentId: string,
    title: string,
    description?: string,
    priority?: NonNullable<Task["priority"]>,
  ) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const [canvasState, setCanvasState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const plan = useMemo(() => officeFloorPlan(agents.length), [agents.length]);
  const roomHeight = plan.height;
  const sceneCharacters = agents.map((agent) => {
    const { latestTask, status } = agentOfficeState(agent, tasks);
    const recentlyDone =
      latestTask?.status === "done" && now - new Date(latestTask.updatedAt).getTime() < 15_000;
    return { agent, status: recentlyDone ? ("done" as const) : status };
  });
  const seats = planSeats(
    sceneCharacters.map(({ status }) => status),
    plan,
  );
  const seatsRef = useRef(seats);
  const previousSeats = useRef(new Map<string, Point>());
  const sceneCharactersRef = useRef(sceneCharacters);
  const sceneSignature = sceneCharacters
    .map(({ agent, status }) => `${agent.id}:${agent.avatarId}:${agent.model}:${status}`)
    .join("|");
  useEffect(() => {
    sceneCharactersRef.current = sceneCharacters;
    seatsRef.current = seats;
  }, [sceneCharacters, seats]);

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
    let motionPreference: MediaQueryList | undefined;
    let updateMotionPreference: ((event: MediaQueryListEvent) => void) | undefined;
    const characters = sceneCharactersRef.current;
    const walkingLabels: WalkingLabel[] = [];

    void (async () => {
      const app = new Application();
      try {
        await app.init({
          width: OFFICE_WIDTH,
          height: plan.height,
          antialias: false,
          autoDensity: true,
          resolution: Math.min(
            Math.max(window.devicePixelRatio || 1, MIN_RENDER_RESOLUTION),
            MAX_RENDER_RESOLUTION,
          ),
          backgroundColor: OFFICE_PALETTE.floor,
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
      await loadCanvasFonts();
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      app.stage.addChild(roomBackground(plan));

      const textures = new Map<string, Texture>();
      await Promise.all(
        characters.map(async ({ agent }) => {
          const petId = getPet(agent.avatarId, hash(agent.id)).id;
          try {
            const texture = await Assets.load<Texture>(
              getPetSpriteUrl(agent.avatarId ?? "", hash(agent.id)),
            );
            texture.source.scaleMode = "nearest";
            textures.set(petId, texture);
          } catch {
            // 이미지 에셋이 없는 펫은 기존 절차적 렌더러로 표시
          }
        }),
      );
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }

      plan.desks.forEach((point, index) =>
        app.stage.addChild(desk(point.x, point.y, characters[index]?.agent.model)),
      );
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const animated: AnimatedPet[] = [];
      characters.forEach(({ agent, status }, index) => {
        const seat = seatsRef.current[index]!;
        const target = { x: seat.x, y: seat.y - PET_RISE_FROM_SEAT };
        const previous = previousSeats.current.get(agent.id);
        const moved = previous && (previous.x !== target.x || previous.y !== target.y);
        const walk =
          moved && !prefersReducedMotion
            ? startWalk(
                corridorPath(previous, target, plan.aisleY - PET_RISE_FROM_SEAT),
                performance.now(),
              )
            : undefined;
        previousSeats.current.set(agent.id, target);
        const item = new Container();
        const pet = petGraphic(agent, textures.get(getPet(agent.avatarId, hash(agent.id)).id));
        pet.position.set(37, -4);
        item.addChild(pet);
        const start = walk ? walk.path[0]! : target;
        item.position.set(start.x, start.y);
        app.stage.addChild(item);
        const character: AnimatedPet = {
          walk,
          item,
          baseX: start.x,
          baseY: start.y,
          status,
          phase: index * 0.7,
          petId: agent.avatarId,
        };
        animated.push(character);
        const label = labelLayer.current?.querySelector<HTMLElement>(
          `[data-agent-id="${agent.id}"]`,
        );
        if (walk && label) walkingLabels.push({ element: label, pet: character, target });
      });

      motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
      let reduceMotion = motionPreference.matches;
      updateMotionPreference = (event: MediaQueryListEvent) => {
        reduceMotion = event.matches;
      };
      motionPreference.addEventListener("change", updateMotionPreference);
      animation = (ticker) => {
        if (reduceMotion) return;
        const time = performance.now() / 350;
        const nowMs = performance.now();
        for (const character of animated) animatePet(character, time, ticker.deltaTime, nowMs);
        followWalkingPets(walkingLabels, element.clientWidth / OFFICE_WIDTH);
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
      for (const { element: label } of walkingLabels) label.style.translate = "";
      if (motionPreference && updateMotionPreference)
        motionPreference.removeEventListener("change", updateMotionPreference);
      element.replaceChildren();
    };
  }, [plan, sceneSignature]);

  const labels = agents.map((agent, index) => {
    const { latestTask, status } = agentOfficeState(agent, tasks);
    const agentTasks = tasks.filter(
      (task) => task.assigneeAgentId === agent.id && task.status !== "done",
    );
    const recentlyDone =
      latestTask?.status === "done" && now - new Date(latestTask.updatedAt).getTime() < 15_000;
    const cycleSecond = Math.floor(now / 1_000) + (Math.abs(hash(agent.id)) % 13);
    const message =
      deskLabels[agent.id] ??
      petMessage({ petId: agent.avatarId, status, recentlyDone, cycleSecond });
    const { x, y } = seats[index]!;
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
    <>
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
        <Styled.LabelLayer ref={labelLayer} $ready={canvasState === "ready"}>
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
      {agents.length > 0 && (
        <Styled.AccessibleList>
          <summary>목록으로 보기</summary>
          <ul aria-label="오피스에 있는 에이전트 현황">
            {labels.map(({ agent, status, tasks: agentTasks }) => (
              <li key={agent.id}>
                <Styled.AccessibleDot
                  style={{ background: OFFICE_STATUS_GROUP_META[officeStatusGroup(status)].color }}
                />
                <strong>{agent.name}</strong>
                <span>{OFFICE_STATUS_LABEL[status]}</span>
                {agentTasks[0] && <small>{agentTasks[0].title}</small>}
              </li>
            ))}
          </ul>
        </Styled.AccessibleList>
      )}
    </>
  );
}
