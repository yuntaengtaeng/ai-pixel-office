import assert from "node:assert/strict";
import test from "node:test";
import { pixelShadow } from "../apps/web/src/features/splash/utils/pixelArt.ts";

test("draws each painted cell one unit down-right of its grid position", () => {
  const shadow = pixelShadow(["W.", ".Y"], 4, { W: "#fff", Y: "#ff0" });

  assert.equal(shadow, "4px 4px 0 0 #fff, 8px 8px 0 0 #ff0");
});

test("leaves cells without a palette color empty", () => {
  assert.equal(pixelShadow(["...", "..."], 4, { W: "#fff" }), "");
});
