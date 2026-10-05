import assert from "node:assert/strict";
import test from "node:test";
import {
  officeFloorPlan,
  planSeats,
} from "../apps/web/src/features/office/utils/officeFloorPlan.ts";

test("gives every colleague a desk and grows the office by desk rows", () => {
  const small = officeFloorPlan(3);
  const large = officeFloorPlan(6);

  assert.equal(small.desks.length, 4);
  assert.equal(large.desks.length, 8);
  assert.ok(large.height > small.height);
});

test("sends colleagues waiting for my decision to the queue at my desk", () => {
  const plan = officeFloorPlan(3);

  const seats = planSeats(["working", "needs_review", "idle"], plan);

  assert.deepEqual(
    seats.map((seat) => seat.atMyDesk),
    [false, true, false],
  );
  assert.deepEqual({ x: seats[1]!.x, y: seats[1]!.y }, plan.queueSlots[0]);
  assert.deepEqual({ x: seats[0]!.x, y: seats[0]!.y }, plan.desks[0]);
});

test("keeps extra waiting colleagues at their own desk when the queue is full", () => {
  const plan = officeFloorPlan(3);

  const seats = planSeats(["needs_input", "failed", "needs_review"], plan);

  assert.deepEqual(
    seats.map((seat) => seat.atMyDesk),
    [true, true, false],
  );
  assert.deepEqual({ x: seats[2]!.x, y: seats[2]!.y }, plan.desks[2]);
});
