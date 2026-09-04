import { spawn } from "node:child_process";
import electronPath from "electron";

const child = spawn(electronPath, process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    PIXEL_OFFICE_WEB_URL: process.env.PIXEL_OFFICE_WEB_URL ?? "http://127.0.0.1:47371",
  },
});

child.once("error", (error) => {
  console.error("Failed to launch Electron", error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Electron stopped by signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
