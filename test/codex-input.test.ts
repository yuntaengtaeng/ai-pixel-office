import assert from "node:assert/strict";
import test from "node:test";
import { buildCodexInput } from "../scripts/runtime-spike/codex.ts";

test("keeps a text-only prompt as a single text input item", () => {
  assert.deepEqual(buildCodexInput("이미지를 확인해줘"), [
    { type: "text", text: "이미지를 확인해줘" },
  ]);
});

test("separates image attachments into localImage input items", () => {
  const input = buildCodexInput("이 이미지를 확인해줘", [
    { mediaType: "image/png", storagePath: "C:\\attachments\\screen.png" },
  ]);
  assert.deepEqual(input, [
    { type: "text", text: "이 이미지를 확인해줘" },
    { type: "localImage", path: "C:\\attachments\\screen.png" },
  ]);
});

test("leaves non-image attachments out of the input array", () => {
  const input = buildCodexInput("파일을 확인해줘", [
    { mediaType: "application/pdf", storagePath: "C:\\attachments\\spec.pdf" },
  ]);
  assert.deepEqual(input, [{ type: "text", text: "파일을 확인해줘" }]);
});

test("keeps SVG as a readable file path instead of a vision image", () => {
  assert.deepEqual(
    buildCodexInput("SVG를 확인해줘", [
      { mediaType: "image/svg+xml", storagePath: "C:\\attachments\\diagram.svg" },
    ]),
    [{ type: "text", text: "SVG를 확인해줘" }],
  );
});

test("mixes image and non-image attachments, keeping only images as localImage items", () => {
  const input = buildCodexInput("확인해줘", [
    { mediaType: "application/pdf", storagePath: "C:\\attachments\\spec.pdf" },
    { mediaType: "image/jpeg", storagePath: "C:\\attachments\\photo.jpg" },
  ]);
  assert.deepEqual(input, [
    { type: "text", text: "확인해줘" },
    { type: "localImage", path: "C:\\attachments\\photo.jpg" },
  ]);
});
