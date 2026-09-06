import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = 4173;

const build = spawnSync(
  process.platform === "win32" ? "cmd.exe" : "pnpm",
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm --filter @ai-pixel-office/pet build:browser"]
    : ["--filter", "@ai-pixel-office/pet", "build:browser"],
  { cwd: repoRoot, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};
const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const relativePath = requestPath === "/" ? "/packages/pet/pet-gallery-preview.html" : requestPath;
  const target = path.resolve(repoRoot, `.${relativePath}`);
  if (!target.startsWith(repoRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(target);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

function openInBrowser(target) {
  if (process.platform === "win32")
    return spawn("cmd", ["/c", "start", "", target], { detached: true });
  if (process.platform === "darwin") return spawn("open", [target], { detached: true });
  return spawn("xdg-open", [target], { detached: true });
}

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/packages/pet/pet-gallery-preview.html`;
  openInBrowser(url).unref();
  console.log(`Pet gallery: ${url}`);
  console.log("Press Ctrl+C to stop the gallery server.");
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
