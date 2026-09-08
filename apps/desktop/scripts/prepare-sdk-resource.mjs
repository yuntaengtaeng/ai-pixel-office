// pnpm links @anthropic-ai/claude-agent-sdk from apps/server/node_modules into the pnpm
// store as a symlink pointing at an absolute path on this machine. electron-builder's
// extraResources copy preserves that symlink as-is instead of resolving it, so the
// packaged app looks for the SDK at a path that only exists on the machine it was built
// on. Dereference it into a real directory here so the packaged resource is self-contained.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../../server/node_modules/@anthropic-ai");
const dest = resolve(__dirname, "../resources/anthropic-ai");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true, dereference: true });

console.log(`[prepare-sdk-resource] dereferenced ${src} -> ${dest}`);
