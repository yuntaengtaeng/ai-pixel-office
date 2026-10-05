import assert from "node:assert/strict";
import test from "node:test";
import {
  corridorPath,
  positionOnWalk,
  startWalk,
  walkDurationMs,
} from "../apps/web/src/features/office/utils/petWalk.ts";

test("takes longer to walk farther, within limits", () => {
  const near = walkDurationMs([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
  const far = walkDurationMs([
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
  ]);
  assert.ok(far > near);
  assert.ok(near >= 700);
  assert.ok(far <= 3200);
});

test("leaves the seat into the corridor, crosses it, then enters the destination", () => {
  const path = corridorPath({ x: 100, y: 100 }, { x: 400, y: 300 }, 200);

  assert.deepEqual(path, [
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 400, y: 200 },
    { x: 400, y: 300 },
  ]);
});

test("skips corridor points that coincide with the seat or destination", () => {
  const path = corridorPath({ x: 100, y: 200 }, { x: 400, y: 300 }, 200);

  assert.deepEqual(path, [
    { x: 100, y: 200 },
    { x: 400, y: 200 },
    { x: 400, y: 300 },
  ]);
});

test("follows the path in order and arrives at the destination", () => {
  const walk = startWalk(corridorPath({ x: 100, y: 100 }, { x: 400, y: 300 }, 200), 0);

  const early = positionOnWalk(walk, walk.durationMs * 0.2);
  const middle = positionOnWalk(walk, walk.durationMs * 0.5);
  const late = positionOnWalk(walk, walk.durationMs * 0.95);
  const end = positionOnWalk(walk, walk.durationMs + 1);

  assert.equal(early.x, 100);
  assert.ok(early.y > 100 && early.y <= 200);
  assert.equal(middle.y, 200);
  assert.ok(middle.x > 100 && middle.x < 400);
  assert.equal(late.x, 400);
  assert.ok(late.y > 200 && late.y < 300);
  assert.deepEqual(end, { x: 400, y: 300, arrived: true });
});
