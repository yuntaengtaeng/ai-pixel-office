import type { TaskStatus } from "@ai-pixel-office/domain/entities";
import { isAwaitingUser } from "@ai-pixel-office/domain/task-state";

export const OFFICE_WIDTH = 760;

const DESK_COLUMNS_X = [68, 244, 420, 596] as const;
const TOP_BAND_HEIGHT = 190;
const DESK_ROW_GAP = 142;
const FIRST_DESK_ROW_Y = TOP_BAND_HEIGHT + 90;
const BOTTOM_BAND_HEIGHT = 230;
const MIN_DESK_SLOTS = 4;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type OfficeFloorPlan = {
  width: number;
  height: number;
  /** 동료마다 정해진 책상 위치 (책상 윗면 왼쪽 모서리) */
  desks: Point[];
  /** 판단을 기다리는 동료가 서는 자리 (책상 좌표계와 같음) */
  queueSlots: Point[];
  /** 자리 사이를 오갈 때 지나는 가로 통로의 y (책상 좌표계와 같음) */
  aisleY: number;
  planningRoom: Rect;
  testRoom: Rect;
  pantry: Rect;
  myDeskZone: Rect;
  entrance: Rect;
};

/** 동료 수에 맞는 오피스 평면도 */
export function officeFloorPlan(agentCount: number): OfficeFloorPlan {
  const deskSlots = Math.max(
    MIN_DESK_SLOTS,
    Math.ceil(agentCount / DESK_COLUMNS_X.length) * DESK_COLUMNS_X.length,
  );
  const rows = deskSlots / DESK_COLUMNS_X.length;
  const desks = Array.from({ length: deskSlots }, (_, index) => ({
    x: DESK_COLUMNS_X[index % DESK_COLUMNS_X.length]!,
    y: FIRST_DESK_ROW_Y + Math.floor(index / DESK_COLUMNS_X.length) * DESK_ROW_GAP,
  }));
  const bottomBandY = FIRST_DESK_ROW_Y + (rows - 1) * DESK_ROW_GAP + 100;
  const height = bottomBandY + BOTTOM_BAND_HEIGHT;
  const myDeskZone = { x: 360, y: bottomBandY + 14, width: 394, height: BOTTOM_BAND_HEIGHT - 20 };
  return {
    width: OFFICE_WIDTH,
    height,
    desks,
    queueSlots: [0, 1].map((index) => ({
      x: myDeskZone.x + 12 + index * 132,
      y: myDeskZone.y + 160,
    })),
    aisleY: bottomBandY + 12,
    planningRoom: { x: 6, y: 6, width: 230, height: TOP_BAND_HEIGHT - 30 },
    testRoom: { x: 560, y: 6, width: 194, height: TOP_BAND_HEIGHT - 30 },
    pantry: { x: 6, y: bottomBandY + 14, width: 220, height: BOTTOM_BAND_HEIGHT - 20 },
    myDeskZone,
    entrance: { x: 238, y: height - 6, width: 110, height: 6 },
  };
}

export type Seat = Point & { atMyDesk: boolean };

/**
 * 동료별 서 있는 위치 (판단을 기다리면 내 자리 앞 줄, 아니면 자기 책상)
 * 줄 자리가 모자라면 남은 동료는 자기 책상에서 기다림
 */
export function planSeats(
  statuses: Array<TaskStatus | "idle" | "done">,
  plan: Pick<OfficeFloorPlan, "desks" | "queueSlots">,
): Seat[] {
  let nextQueueSlot = 0;
  return statuses.map((status, index) => {
    const desk = plan.desks[index]!;
    const queueSlot = plan.queueSlots[nextQueueSlot];
    if (isAwaitingUser(status) && queueSlot) {
      nextQueueSlot += 1;
      return { ...queueSlot, atMyDesk: true };
    }
    return { ...desk, atMyDesk: false };
  });
}
