import assert from "node:assert/strict";
import test from "node:test";
import { petMessage } from "../apps/web/src/features/office/utils/pet-personality.ts";

test("미션 펫은 상태별 고유 멘트를 사용한다", () => {
  assert.equal(
    petMessage({ petId: "rabbit-yuzu", status: "working", recentlyDone: false, cycleSecond: 0 }),
    "손이 아주 바빠!",
  );
  assert.equal(
    petMessage({
      petId: "capybara-gamja",
      status: "needs_review",
      recentlyDone: false,
      cycleSecond: 0,
    }),
    "편하게 한번 봐 줘",
  );
  assert.equal(
    petMessage({ petId: "quokka-bangul", status: "idle", recentlyDone: false, cycleSecond: 0 }),
    "누가 먼저 웃나 기다리는 중",
  );
  assert.equal(
    petMessage({ petId: "dog-shiba", status: "idle", recentlyDone: false, cycleSecond: 6 }),
    undefined,
  );
});
