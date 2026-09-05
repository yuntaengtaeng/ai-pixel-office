import assert from "node:assert/strict";
import test from "node:test";
import { isSubmitKey, type SubmitKeyEvent } from "../apps/web/src/shared/lib/keyboard.ts";

function keyEvent(patch: Partial<SubmitKeyEvent> = {}): SubmitKeyEvent {
  return {
    key: "Enter",
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    nativeEvent: {},
    ...patch,
  };
}

test("submits plain Enter but preserves Shift+Enter line breaks", () => {
  assert.equal(isSubmitKey(keyEvent()), true);
  assert.equal(isSubmitKey(keyEvent({ shiftKey: true })), false);
});

test("does not submit an Enter used to confirm macOS IME composition", () => {
  assert.equal(isSubmitKey(keyEvent({ nativeEvent: { isComposing: true } })), false);
  assert.equal(isSubmitKey(keyEvent({ nativeEvent: { keyCode: 229 } })), false);
});

test("supports the shared modifier plus Enter shortcut", () => {
  assert.equal(isSubmitKey(keyEvent(), "modifier-enter"), false);
  assert.equal(isSubmitKey(keyEvent({ metaKey: true }), "modifier-enter"), true);
  assert.equal(isSubmitKey(keyEvent({ ctrlKey: true }), "modifier-enter"), true);
});
