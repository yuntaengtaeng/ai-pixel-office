import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const galleryPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/pet/pet-gallery-preview.html",
);

function openInBrowser(target) {
  if (process.platform === "win32")
    return spawn("cmd", ["/c", "start", "", target], { detached: true });
  if (process.platform === "darwin") return spawn("open", [target], { detached: true });
  return spawn("xdg-open", [target], { detached: true });
}

openInBrowser(galleryPath).unref();
console.log(`Opening pet gallery: ${galleryPath}`);
