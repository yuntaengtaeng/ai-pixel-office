// pnpm links @anthropic-ai/claude-agent-sdk from apps/server/node_modules into the pnpm
// store as a symlink pointing at an absolute path on this machine. electron-builder's
// extraResources copy preserves that symlink as-is instead of resolving it, so the
// packaged app looks for the SDK at a path that only exists on the machine it was built
// on. Dereference it into a real directory here so the packaged resource is self-contained.
//
// The SDK also resolves its platform-specific native CLI binary
// (@anthropic-ai/claude-agent-sdk-<platform>) as a sibling inside its OWN pnpm virtual
// store folder, not inside apps/server/node_modules/@anthropic-ai. So the copy source
// must be the real @anthropic-ai/ directory next to the resolved claude-agent-sdk package,
// not the shallow workspace node_modules/@anthropic-ai folder.
import { cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkEntry = resolve(__dirname, "../../server/node_modules/@anthropic-ai/claude-agent-sdk");
const sdkReal = realpathSync(sdkEntry);
const src = dirname(sdkReal);
const dest = resolve(__dirname, "../resources/anthropic-ai");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true, dereference: true });

console.log(`[prepare-sdk-resource] dereferenced ${src} -> ${dest}`);
