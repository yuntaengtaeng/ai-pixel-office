import assert from "node:assert/strict";
import test from "node:test";
import { createPet, getPet, PETS } from "../packages/pet/src/index.ts";

test("알 수 없는 펫 ID는 fallbackIndex의 펫을 반환한다", () => {
  assert.equal(getPet("unknown", 1), PETS[1]);
  assert.equal(getPet(undefined, 22).unlock, undefined);
});

test("미션 펫은 기존 카탈로그와 겹치지 않는 종과 이름을 가진다", () => {
  assert.deepEqual(
    PETS.slice(-3).map(({ species, name }) => [species, name]),
    [
      ["rabbit", "유자"],
      ["capybara", "감자"],
      ["quokka", "방울"],
    ],
  );
});

test("pet.move와 tick으로 렌더러 독립 이동 상태를 갱신한다", () => {
  const pet = createPet({ position: { x: 0, y: 0 }, speedPxPerSecond: 10 });

  pet.move({ x: 10, y: 0 });
  assert.deepEqual(pet.tick(500), {
    design: PETS[0],
    position: { x: 5, y: 0 },
    direction: "right",
    motion: "moving",
  });
  assert.deepEqual(pet.tick(500).position, { x: 10, y: 0 });
  assert.equal(pet.snapshot().motion, "idle");
});
