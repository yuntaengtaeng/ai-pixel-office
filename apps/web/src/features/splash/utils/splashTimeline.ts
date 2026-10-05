export const COMMUTER_COUNT = 3;

const SURPRISE_AT_MS = 550;
const FIRST_DEPARTURE_MS = 900;
const DEPARTURE_GAP_MS = 280;
const TRAVEL_MS = 1600;
const SETTLE_MS = 500;

/** 무대 가로 위치 (%) — 왼쪽 픽셀 마을, 가운데 등록 게이트, 오른쪽 사무실 */
export const GATE_CENTER_PERCENT = 49;
const MEADOW_FRONT_PERCENT = 26;
const MEADOW_GAP_PERCENT = 9;
const OFFICE_FRONT_PERCENT = 87;
const OFFICE_GAP_PERCENT = 12;

/** 사무실 자리 왼쪽부터 받는 역할 */
export const AGENT_ROLES = ["기획", "디자인", "개발"] as const;

export type CommuterTimeline = {
  /** 픽셀 마을에서의 위치와 사무실 자리 */
  fromPercent: number;
  toPercent: number;
  /** 게이트가 열려 놀라는 시각 */
  surpriseAtMs: number;
  /** 컨베이어에 실려 출발하는 시각 */
  departAtMs: number;
  /** 게이트를 지나 사원증과 역할을 받는 시각 */
  badgeAtMs: number;
  /** 자리에 도착해 모니터가 켜지는 시각 */
  arriveAtMs: number;
  travelMs: number;
};

/** 줄 맨 앞(0)부터 차례로 끌려가는 동료의 위치와 시각 */
export function commuterTimeline(lane: number): CommuterTimeline {
  const fromPercent = MEADOW_FRONT_PERCENT - lane * MEADOW_GAP_PERCENT;
  const toPercent = OFFICE_FRONT_PERCENT - lane * OFFICE_GAP_PERCENT;
  const departAtMs = FIRST_DEPARTURE_MS + lane * DEPARTURE_GAP_MS;
  const gateRatio = (GATE_CENTER_PERCENT - fromPercent) / (toPercent - fromPercent);
  return {
    fromPercent,
    toPercent,
    surpriseAtMs: SURPRISE_AT_MS + lane * 90,
    departAtMs,
    badgeAtMs: Math.round(departAtMs + TRAVEL_MS * gateRatio),
    arriveAtMs: departAtMs + TRAVEL_MS,
    travelMs: TRAVEL_MS,
  };
}

/** 마지막 동료가 자리에 앉고 화면이 정리될 때까지 걸리는 시간 */
export function splashIntroMs(commuterCount: number = COMMUTER_COUNT): number {
  return commuterTimeline(commuterCount - 1).arriveAtMs + SETTLE_MS;
}
