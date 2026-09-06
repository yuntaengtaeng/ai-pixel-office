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
import {
  OFFICE_WIDTH,
  desk,
  hash,
  officeLayout,
  petGraphic,
  roomBackground,
} from "./utils/canvasScene.ts";

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
  gap: ${({ theme }) => theme.space.x3};
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
    padding: ${({ theme }) => `${theme.space.x2} 0`};
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

const EmptyLabel = styled.div`
  position: absolute;
  left: 50%;
  top: 59%;
  transform: translate(-50%, -50%);
  color: #705b4e;
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

export function PixelOffice({
  agents,
  tasks,
  onQuickAssign,
  onOpenTask,
}: {
  agents: Agent[];
  tasks: Task[];
  onQuickAssign?: (
    agentId: string,
    title: string,
    description?: string,
    priority?: NonNullable<Task["priority"]>,
  ) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [canvasState, setCanvasState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const { positions, height: roomHeight } = useMemo(
    () => officeLayout(agents.length),
    [agents.length],
  );
  const sceneCharacters = agents.map((agent) => {
    const { latestTask, status } = agentOfficeState(agent, tasks);
    const recentlyDone =
      latestTask?.status === "done" && now - new Date(latestTask.updatedAt).getTime() < 15_000;
    return { agent, status: recentlyDone ? ("done" as const) : status };
  });
  const sceneCharactersRef = useRef(sceneCharacters);
  const sceneSignature = sceneCharacters
    .map(({ agent, status }) => `${agent.id}:${agent.avatarId}:${agent.model}:${status}`)
    .join("|");
  useEffect(() => {
    sceneCharactersRef.current = sceneCharacters;
  }, [sceneCharacters]);

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

      const textures = new Map<string, Texture>();
      await Promise.all(
        characters.map(async ({ agent }) => {
          const petId = getPet(agent.avatarId, hash(agent.id)).id;
          try {
            textures.set(
              petId,
              await Assets.load(getPetSpriteUrl(agent.avatarId ?? "", hash(agent.id))),
            );
          } catch {
            // 이미지 에셋이 없는 펫은 기존 절차적 렌더러로 표시
          }
        }),
      );
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }

      positions.forEach(([x, y], index) =>
        app.stage.addChild(desk(x, y, characters[index]?.agent.model)),
      );

      const animated: AnimatedPet[] = [];
      characters.forEach(({ agent, status }, index) => {
        const [deskX, deskY] = positions[index]!;
        const item = new Container();
        const pet = petGraphic(agent, textures.get(getPet(agent.avatarId, hash(agent.id)).id));
        pet.position.set(37, -4);
        item.addChild(pet);
        item.position.set(deskX!, deskY! - 70);
        app.stage.addChild(item);
        animated.push({
          item,
          baseX: item.x,
          baseY: item.y,
          status,
          phase: index * 0.7,
          petId: agent.avatarId,
        });
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
        for (const character of animated) animatePet(character, time, ticker.deltaTime);
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
      if (motionPreference && updateMotionPreference)
        motionPreference.removeEventListener("change", updateMotionPreference);
      element.replaceChildren();
    };
  }, [positions, roomHeight, sceneSignature]);

  const labels = agents.map((agent, index) => {
    const { latestTask, status } = agentOfficeState(agent, tasks);
    const agentTasks = tasks.filter(
      (task) => task.assigneeAgentId === agent.id && task.status !== "done",
    );
    const recentlyDone =
      latestTask?.status === "done" && now - new Date(latestTask.updatedAt).getTime() < 15_000;
    const cycleSecond = Math.floor(now / 1_000) + (Math.abs(hash(agent.id)) % 13);
    const message = petMessage({ petId: agent.avatarId, status, recentlyDone, cycleSecond });
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
