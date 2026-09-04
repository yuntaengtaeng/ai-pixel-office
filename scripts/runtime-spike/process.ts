import {
  execFile,
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let cachedRuntimeEnvironment: NodeJS.ProcessEnv | undefined;

export function runtimeEnvironment(): NodeJS.ProcessEnv {
  if (cachedRuntimeEnvironment) return cachedRuntimeEnvironment;
  const inherited = { ...process.env };
  if (process.platform === "win32") return (cachedRuntimeEnvironment = inherited);

  const shell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/sh");
  try {
    const marker = "__AI_PIXEL_OFFICE_PATH__=";
    const output = execFileSync(shell, ["-ilc", `printf '\\n${marker}%s\\n' "$PATH"`], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const loginPath = output
      .split(/\r?\n/)
      .findLast((line) => line.startsWith(marker))
      ?.slice(marker.length);
    if (loginPath) inherited.PATH = mergePath(loginPath, inherited.PATH);
  } catch {
    // The inherited environment still works for ordinary terminal launches.
  }
  return (cachedRuntimeEnvironment = inherited);
}

function mergePath(primary: string, fallback?: string): string {
  return [...new Set(`${primary}:${fallback ?? ""}`.split(":").filter(Boolean))].join(":");
}

export function spawnCodex(args: string[]): ChildProcessWithoutNullStreams {
  if (process.platform === "win32") {
    const commandShell = process.env.ComSpec ?? "cmd.exe";
    const commandLine = ["codex.cmd", ...args].join(" ");
    return spawn(commandShell, ["/d", "/s", "/c", commandLine], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  return spawn("codex", args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: runtimeEnvironment(),
  });
}

export function spawnClaude(args: string[], cwd?: string): ChildProcessWithoutNullStreams {
  if (process.platform === "win32") {
    const commandShell = process.env.ComSpec ?? "cmd.exe";
    const commandLine = ["claude.cmd", ...args.map(quoteWindowsCmdArgument)].join(" ");
    return spawn(commandShell, ["/d", "/s", "/c", commandLine], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      cwd,
    });
  }

  return spawn("claude", args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd,
    env: runtimeEnvironment(),
  });
}

export function quoteWindowsCmdArgument(value: string): string {
  if (/[\r\n"%&|<>^!]/.test(value)) {
    throw new Error("Unsafe Claude CLI argument");
  }
  return /\s/.test(value) ? `"${value}"` : value;
}

export async function runtimeVersion(runtime: "codex" | "claude"): Promise<string | null> {
  const executable = process.platform === "win32" ? `${runtime}.cmd` : runtime;
  try {
    const command =
      process.platform === "win32"
        ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `${executable} --version`]]
        : [executable, ["--version"]];
    const { stdout, stderr } = await execFileAsync(command[0] as string, command[1] as string[], {
      windowsHide: true,
      env: runtimeEnvironment(),
    });
    const lines = `${stdout}\n${stderr}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const versionLine = lines.find((line) =>
      runtime === "codex" ? /^codex-cli\s/i.test(line) : /Claude Code/i.test(line),
    );
    return versionLine ?? lines[0] ?? null;
  } catch {
    return null;
  }
}
