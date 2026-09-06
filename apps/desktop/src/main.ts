import { fork, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { runtimeEnvironment } from "../../../scripts/runtime-spike/process.ts";
import type { RuntimeName } from "./preload.ts";

let mainWindow: BrowserWindow | undefined;
let localServerProcess: ChildProcess | undefined;
let isQuitting = false;

type ServerReadyMessage = { type: "ready"; address: string };

function isServerReadyMessage(message: unknown): message is ServerReadyMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<ServerReadyMessage>;
  return candidate.type === "ready" && typeof candidate.address === "string";
}

function startPackagedServer(): Promise<string> {
  const serverEntry = join(process.resourcesPath, "server", "server.cjs");
  const child = fork(serverEntry, [], {
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PIXEL_OFFICE_SERVER_HOST: "127.0.0.1",
      PIXEL_OFFICE_SERVER_PORT: "0",
      PIXEL_OFFICE_DATABASE_PATH: join(app.getPath("userData"), "ai-pixel-office.sqlite"),
      PIXEL_OFFICE_GENERAL_WORKING_DIRECTORY: join(app.getPath("userData"), "general"),
      PIXEL_OFFICE_RUNTIME_LOG_DIRECTORY: join(app.getPath("userData"), "runtime-logs"),
      PIXEL_OFFICE_STATIC_ROOT: join(process.resourcesPath, "web"),
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  localServerProcess = child;
  child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[server] ${chunk}`));
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[server] ${chunk}`));

  return new Promise((resolve, reject) => {
    let ready = false;
    const timeout = setTimeout(() => {
      reject(new Error("Local server did not become ready within 15 seconds"));
      child.kill();
    }, 15_000);

    child.on("message", (message) => {
      if (!isServerReadyMessage(message) || ready) return;
      ready = true;
      clearTimeout(timeout);
      resolve(message.address);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      localServerProcess = undefined;
      if (ready || isQuitting) return;
      clearTimeout(timeout);
      reject(
        new Error(
          `Local server exited before startup (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    });
  });
}

function stopPackagedServer(): Promise<void> {
  const child = localServerProcess;
  if (!child || child.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill();
      resolve();
    }, 3_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.send({ type: "shutdown" }, (error) => {
      if (!error) return;
      clearTimeout(timeout);
      child.kill();
      resolve();
    });
  });
}

const RUNTIME_NPM_PACKAGE: Record<RuntimeName, string> = {
  codex: "@openai/codex",
  claude: "@anthropic-ai/claude-code",
};

type InstallRuntimeResult = { ok: true } | { ok: false; message: string };

function installRuntimeCli(runtime: RuntimeName): Promise<InstallRuntimeResult> {
  const npmPackage = RUNTIME_NPM_PACKAGE[runtime];
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["install", "-g", npmPackage];
  const child =
    process.platform === "win32"
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        })
      : spawn(npmCommand, args, {
          stdio: ["ignore", "pipe", "pipe"],
          env: runtimeEnvironment(),
        });

  return new Promise((resolve) => {
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_096);
    });
    child.once("error", (error) => {
      resolve({ ok: false, message: error.message });
    });
    child.once("exit", (code) => {
      if (code === 0) resolve({ ok: true });
      else
        resolve({
          ok: false,
          message: stderr.trim() || `npm install이 코드 ${String(code)}로 종료되었습니다.`,
        });
    });
  });
}

function spawnRuntimeCommand(
  runtime: RuntimeName,
  args: string[],
  options: { detached?: boolean } = {},
): ChildProcess {
  const command = process.platform === "win32" ? `${runtime}.cmd` : runtime;
  const stdio: import("node:child_process").StdioOptions = options.detached
    ? "ignore"
    : ["ignore", "pipe", "pipe"];
  return process.platform === "win32"
    ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...args], {
        detached: options.detached,
        stdio,
        windowsHide: true,
      })
    : spawn(command, args, {
        detached: options.detached,
        stdio,
        env: runtimeEnvironment(),
      });
}

function runRuntimeCommand(runtime: RuntimeName, args: string[]): Promise<InstallRuntimeResult> {
  const child = spawnRuntimeCommand(runtime, args);
  return new Promise((resolve) => {
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_096);
    });
    child.once("error", (error) => {
      resolve({ ok: false, message: error.message });
    });
    child.once("exit", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, message: stderr.trim() || `명령이 코드 ${String(code)}로 종료되었습니다.` });
    });
  });
}

function launchRuntimeCommand(runtime: RuntimeName, args: string[]): { started: true } {
  spawnRuntimeCommand(runtime, args, { detached: true }).unref();
  return { started: true };
}

function launchRuntimeLogin(runtime: RuntimeName): { started: true } {
  return launchRuntimeCommand(runtime, runtime === "codex" ? ["login"] : ["auth", "login"]);
}

// Figma MCP 연동은 Codex/Claude 두 런타임 모두 지원 대상이 늘어날 걸 대비해 이름을 남겨 둠
const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";

function configureFigmaMcp(runtime: RuntimeName): Promise<InstallRuntimeResult> {
  const args =
    runtime === "codex"
      ? ["mcp", "add", "figma", "--url", FIGMA_MCP_URL]
      : ["mcp", "add", "--transport", "http", "--scope", "user", "figma-remote-mcp", FIGMA_MCP_URL];
  return runRuntimeCommand(runtime, args);
}

// Claude의 MCP 로그인 확인은 CLI 안에서 /mcp를 직접 쳐야 하는 대화형 단계라
// 백그라운드로 조용히 실행해도 아무 효과가 없음 - 눈에 보이는 터미널을 띄워 사용자가 이어서 입력하게 함
function openInteractiveTerminal(command: string): { started: true } {
  if (process.platform === "win32") {
    spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "start", "", "cmd", "/k", `${command}.cmd`], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }).unref();
  } else {
    spawn("osascript", ["-e", `tell application "Terminal" to do script "${command}"`], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
  return { started: true };
}

function connectFigmaMcp(runtime: RuntimeName): { started: true } {
  if (runtime === "codex") return launchRuntimeCommand("codex", ["mcp", "login", "figma"]);
  return openInteractiveTerminal("claude");
}

async function createMainWindow(): Promise<void> {
  const developmentUrl = process.env.PIXEL_OFFICE_WEB_URL;
  const rendererUrl = developmentUrl ?? (await startPackagedServer());

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#eee7dc",
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  await mainWindow.loadURL(rendererUrl);
}

// Windows requires a registered AppUserModelID for `new Notification(...)` to surface as a
// native toast instead of failing silently while the app runs unpackaged (dev/electron .).
if (process.platform === "win32") app.setAppUserModelId("io.aipixeloffice.desktop");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  ipcMain.handle("runtime:connect", (_event, runtime: RuntimeName) => {
    if (runtime !== "codex" && runtime !== "claude") throw new Error("Unknown runtime");
    return launchRuntimeLogin(runtime);
  });
  ipcMain.handle("runtime:install", (_event, runtime: RuntimeName) => {
    if (runtime !== "codex" && runtime !== "claude") throw new Error("Unknown runtime");
    return installRuntimeCli(runtime);
  });
  ipcMain.handle("mcp:configureFigma", (_event, runtime: RuntimeName) => {
    if (runtime !== "codex" && runtime !== "claude") throw new Error("Unknown runtime");
    return configureFigmaMcp(runtime);
  });
  ipcMain.handle("mcp:connectFigma", (_event, runtime: RuntimeName) => {
    if (runtime !== "codex" && runtime !== "claude") throw new Error("Unknown runtime");
    return connectFigmaMcp(runtime);
  });
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  void app
    .whenReady()
    .then(createMainWindow)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to start AI Pixel Office", error);
      dialog.showErrorBox("AI Pixel Office를 시작할 수 없습니다", message);
      app.quit();
    });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", (event) => {
  if (isQuitting || !localServerProcess) return;
  event.preventDefault();
  isQuitting = true;
  void stopPackagedServer().finally(() => app.quit());
});
