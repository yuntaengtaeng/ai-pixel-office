import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUTER_COUNT,
  GATE_CENTER_PERCENT,
  commuterTimeline,
  splashIntroMs,
} from "../apps/web/src/features/splash/utils/splashTimeline.ts";

const lanes = Array.from({ length: COMMUTER_COUNT }, (_, lane) => commuterTimeline(lane));

test("every commuter starts in the pixel meadow and ends in the office past the gate", () => {
  for (const lane of lanes) {
    assert.ok(lane.fromPercent < GATE_CENTER_PERCENT);
    assert.ok(lane.toPercent > GATE_CENTER_PERCENT);
  }
});

test("the front of the line leaves first and takes the farthest seat, so nobody overtakes", () => {
  for (let index = 1; index < lanes.length; index += 1) {
    assert.ok(lanes[index]!.departAtMs > lanes[index - 1]!.departAtMs);
    assert.ok(lanes[index]!.fromPercent < lanes[index - 1]!.fromPercent);
    assert.ok(lanes[index]!.toPercent < lanes[index - 1]!.toPercent);
  }
});

test("a commuter is surprised before leaving and gets the badge while crossing the gate", () => {
  for (const lane of lanes) {
    assert.ok(lane.surpriseAtMs < lane.departAtMs);
    assert.ok(lane.badgeAtMs > lane.departAtMs && lane.badgeAtMs < lane.arriveAtMs);
  }
});

test("the gate moment matches where the conveyor carries the commuter", () => {
  const lane = lanes[0]!;
  const ratio = (lane.badgeAtMs - lane.departAtMs) / lane.travelMs;
  const position = lane.fromPercent + (lane.toPercent - lane.fromPercent) * ratio;

  assert.ok(Math.abs(position - GATE_CENTER_PERCENT) < 0.5);
});

test("the intro lasts until the last commuter has arrived", () => {
  const last = lanes[lanes.length - 1]!;

  assert.ok(splashIntroMs() > last.arriveAtMs);
  assert.ok(splashIntroMs() < 5_000);
});
