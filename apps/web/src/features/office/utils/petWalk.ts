import type { Point } from "./officeFloorPlan.ts";

export type PetWalk = {
  /** 출발점부터 도착점까지 지나는 점들 */
  path: Point[];
  startedAtMs: number;
  durationMs: number;
};

const WALK_SPEED_PX_PER_MS = 0.16;
const MIN_WALK_MS = 700;
const MAX_WALK_MS = 3200;

function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function pathLength(path: Point[]): number {
  return path.slice(1).reduce((sum, point, index) => sum + distance(path[index]!, point), 0);
}

/** 자리에서 통로로 나와 가로로 이동한 뒤 목적지로 들어가는 경로 */
export function corridorPath(from: Point, to: Point, corridorY: number): Point[] {
  const path = [from, { x: from.x, y: corridorY }, { x: to.x, y: corridorY }, to];
  return path.filter((point, index) => index === 0 || distance(path[index - 1]!, point) > 0);
}

/** 경로를 걷는 데 걸리는 시간 */
export function walkDurationMs(path: Point[]): number {
  return Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, pathLength(path) / WALK_SPEED_PX_PER_MS));
}

export function startWalk(path: Point[], nowMs: number): PetWalk {
  return { path, startedAtMs: nowMs, durationMs: walkDurationMs(path) };
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
}

/**
 * 걷는 중인 위치 (경로를 따라 천천히 출발해 천천히 멈춤)
 * 도착하면 arrived가 true이고 위치는 마지막 점
 */
export function positionOnWalk(walk: PetWalk, nowMs: number): Point & { arrived: boolean } {
  const destination = walk.path[walk.path.length - 1]!;
  const progress = Math.min(1, Math.max(0, (nowMs - walk.startedAtMs) / walk.durationMs));
  if (progress >= 1) return { ...destination, arrived: true };
  let remaining = easeInOut(progress) * pathLength(walk.path);
  for (let index = 1; index < walk.path.length; index += 1) {
    const from = walk.path[index - 1]!;
    const to = walk.path[index]!;
    const segment = distance(from, to);
    if (remaining <= segment) {
      const ratio = segment === 0 ? 1 : remaining / segment;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        arrived: false,
      };
    }
    remaining -= segment;
  }
  return { ...destination, arrived: false };
}
