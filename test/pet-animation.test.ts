import assert from "node:assert/strict";
import test from "node:test";
import { getPetAnimation, idleActionAt, walkingFrame } from "../packages/pet/src/index.ts";

test("an idle pet goes through several different actions over time", () => {
  const actions = new Set(
    Array.from({ length: 40 }, (_, cycle) => idleActionAt(cycle * 14 + 1, 0).action),
  );
  assert.ok(actions.size >= 4, `expected varied idle actions, got ${[...actions].join(", ")}`);
});

test("pets with different phases are not doing the same thing at the same moment", () => {
  const moment = 100;
  const actions = new Set(
    [0, 0.7, 1.4, 2.1, 2.8].map((phase) => idleActionAt(moment, phase).action),
  );
  assert.ok(actions.size > 1);
});

test("walking bounces the pet up and down", () => {
  const heights = Array.from({ length: 20 }, (_, index) => walkingFrame(index * 0.1).y);
  assert.ok(Math.min(...heights) < -2);
  assert.ok(heights.every((y) => y <= 0));
});

test("a waiting pet hops at the start of each cycle and stays grounded otherwise", () => {
  const animation = getPetAnimation("dog-shiba");
  const hopping = animation.frame({ status: "needs_review", time: 0.8, phase: 0 });
  const waiting = animation.frame({ status: "needs_review", time: 8, phase: 0 });
  assert.ok(hopping.y < 0);
  assert.equal(waiting.y, 0);
});

test("a failed pet slumps down", () => {
  const frame = getPetAnimation("dog-shiba").frame({ status: "failed", time: 5, phase: 0 });
  assert.ok(frame.y > 0);
  assert.ok(frame.scaleY < 1);
});
