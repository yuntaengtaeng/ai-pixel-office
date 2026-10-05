export type PetAnimationStatus =
  "idle" | "working" | "needs_review" | "needs_input" | "done" | "blocked" | "failed";

export type PetAnimationInput = {
  status: PetAnimationStatus;
  /** 애니메이션 시각 (1 = 약 350ms) */
  time: number;
  phase?: number;
  /** 자리를 옮기는 중이면 true */
  walking?: boolean;
};

export type PetAnimationFrame = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export type PetAnimation = {
  frame(input: PetAnimationInput): PetAnimationFrame;
};

/** 쉬는 중인 펫이 돌아가며 하는 행동 */
export type IdleAction = "breathe" | "lookAround" | "stretch" | "hop" | "wander";

const IDLE_ACTIONS: IdleAction[] = ["breathe", "lookAround", "stretch", "hop", "wander"];
/** 행동 하나가 이어지는 길이 (time 단위, 약 4.9초) */
const ACTION_CYCLE = 14;

const baseFrame = (): PetAnimationFrame => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });

export function getPetAnimation(petId: string): PetAnimation {
  return { frame: (input) => petFrame(petId, input) };
}

/** 시각과 펫별 위상에 따른 현재 쉬는 행동과 그 행동 안에서의 진행도(0 이상 1 미만) */
export function idleActionAt(time: number, phase = 0): { action: IdleAction; progress: number } {
  const shifted = time + phase * 3;
  const cycle = Math.floor(shifted / ACTION_CYCLE);
  const seed = Math.abs(Math.round(cycle * 7 + phase * 13));
  return {
    action: IDLE_ACTIONS[seed % IDLE_ACTIONS.length]!,
    progress: (shifted - cycle * ACTION_CYCLE) / ACTION_CYCLE,
  };
}

/** 자리를 옮길 때 걷는 동작 (통통 튀며 좌우로 살짝 기울기) */
export function walkingFrame(time: number, phase = 0): PetAnimationFrame {
  const frame = baseFrame();
  const step = time * 6 + phase;
  frame.y = -Math.round(Math.abs(Math.sin(step)) * 5);
  frame.rotation = Math.sin(step) * 0.07;
  frame.scaleY = 1 - Math.abs(Math.cos(step)) * 0.04;
  return frame;
}

function petFrame(petId: string, input: PetAnimationInput): PetAnimationFrame {
  const phase = input.phase ?? 0;
  if (input.walking) return walkingFrame(input.time, phase);
  if (input.status === "idle") return idleFrame(input.time, phase);
  if (petId === "rabbit-yuzu") return yuzuFrame(input, phase);
  if (petId === "capybara-gamja") return gamjaFrame(input, phase);
  if (petId === "quokka-bangul") return bangulFrame(input, phase);
  return statusFrame(input, phase);
}

function idleFrame(time: number, phase: number): PetAnimationFrame {
  const frame = baseFrame();
  const { action, progress } = idleActionAt(time, phase);
  const pulse = Math.sin(progress * Math.PI);
  switch (action) {
    case "breathe":
      frame.scaleY = 1 + Math.sin(time * 1.2 + phase) * 0.03;
      frame.y = -Math.round(Math.abs(Math.sin(time * 0.6 + phase)) * 1.5);
      break;
    case "lookAround":
      frame.rotation = Math.sin(progress * Math.PI * 4) * 0.12;
      break;
    case "stretch":
      frame.scaleY = 1 + pulse * 0.14;
      frame.scaleX = 1 - pulse * 0.06;
      frame.y = -Math.round(pulse * 4);
      break;
    case "hop": {
      const hopPhase = (progress * 3) % 1;
      frame.y = progress < 0.66 ? -Math.round(Math.sin(hopPhase * Math.PI) * 9) : 0;
      frame.scaleY = progress < 0.66 ? 1 - Math.abs(Math.cos(hopPhase * Math.PI)) * 0.06 : 1;
      break;
    }
    case "wander":
      frame.x = Math.round(Math.sin(progress * Math.PI * 2) * 14);
      frame.y = -Math.round(Math.abs(Math.sin(time * 4 + phase)) * 2);
      frame.rotation = Math.cos(progress * Math.PI * 2) * 0.04;
      break;
  }
  return frame;
}

function isWaitingForPerson(status: PetAnimationStatus): boolean {
  return status === "needs_review" || status === "needs_input";
}

function isStuck(status: PetAnimationStatus): boolean {
  return status === "blocked" || status === "failed";
}

/** 공통 상태 동작: 타이핑하다 생각하기, 서류 들고 기다리기, 완료 점프, 실패 시 풀 죽기 */
function statusFrame(input: PetAnimationInput, phase: number): PetAnimationFrame {
  const frame = baseFrame();
  const { time, status } = input;
  const progress = ((time + phase * 3) % ACTION_CYCLE) / ACTION_CYCLE;
  if (status === "working") {
    const thinking = progress > 0.72;
    frame.y = thinking ? 0 : -Math.round(Math.abs(Math.sin(time * 6 + phase)) * 2);
    frame.x = thinking ? 0 : Math.round(Math.sin(time * 3 + phase));
    frame.rotation = thinking ? Math.sin((progress - 0.72) * Math.PI * 3.5) * 0.1 : 0;
  } else if (isWaitingForPerson(status)) {
    frame.x = Math.round(Math.sin(time * 1.6 + phase) * 3);
    frame.y = progress < 0.12 ? -Math.round(Math.sin((progress / 0.12) * Math.PI) * 8) : 0;
  } else if (status === "done") {
    const jump = Math.abs(Math.sin(time * 2 + phase));
    frame.y = -Math.round(jump * 10);
    frame.scaleY = 1 + (jump - 0.5) * 0.08;
    frame.rotation = Math.sin(time * 2 + phase) * 0.05;
  } else if (isStuck(status)) {
    const sigh = progress < 0.2 ? Math.sin((progress / 0.2) * Math.PI) : 0;
    frame.y = 3;
    frame.scaleY = 0.94 - sigh * 0.04;
    frame.rotation = -0.04 + Math.sin(time * 7 + phase) * 0.01;
  }
  return frame;
}

function yuzuFrame(input: PetAnimationInput, phase: number): PetAnimationFrame {
  const frame = statusFrame(input, phase);
  if (input.status === "working") {
    frame.y = -Math.round(Math.abs(Math.sin(input.time * 2.5 + phase)) * 4);
  }
  return frame;
}

function gamjaFrame(input: PetAnimationInput, phase: number): PetAnimationFrame {
  const frame = statusFrame(input, phase);
  frame.scaleY *= 1 + Math.sin(input.time * 0.35 + phase) * 0.015;
  if (input.status === "working") frame.y = Math.round(Math.sin(input.time * 1.2 + phase));
  return frame;
}

function bangulFrame(input: PetAnimationInput, phase: number): PetAnimationFrame {
  const frame = statusFrame(input, phase);
  frame.rotation += Math.sin(input.time * 0.9 + phase) * 0.025;
  return frame;
}
