import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLocalFilePaths,
  linkifyLocalPaths,
} from "../apps/web/src/shared/lib/localFileLinks.ts";

test("turns a generated Windows ZIP path into a clickable artifact link", () => {
  const path = "C:\\Users\\tester\\result.zip";
  assert.equal(linkifyLocalPaths(path), `[${path}](file:///C:/Users/tester/result.zip)`);
});

test("normalizes a Windows path that is already a Markdown link", () => {
  const markdown = "[결과](C:\\Users\\tester\\바보.zip)";
  assert.equal(
    linkifyLocalPaths(markdown),
    "[결과](file:///C:/Users/tester/%EB%B0%94%EB%B3%B4.zip)",
  );
});

test("finds a Claude-generated artifact path in plain prose", () => {
  const summary =
    "바보4.txt와 바보4.zip 생성 완료했어요:\n\nC:\\Users\\tester\\general\\바보4.zip";
  assert.deepEqual(extractLocalFilePaths(summary), ["C:\\Users\\tester\\general\\바보4.zip"]);
});

test("finds and links a macOS artifact path", () => {
  const path = "/Users/tester/general/result.zip";
  assert.deepEqual(extractLocalFilePaths(`완료: ${path}`), [path]);
  assert.equal(linkifyLocalPaths(path), `[${path}](file:///Users/tester/general/result.zip)`);
});
