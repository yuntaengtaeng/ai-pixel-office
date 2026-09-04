import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { runtimeEnvironment, runtimeVersion } from "../../../scripts/runtime-spike/process.ts";

const execFileAsync = promisify(execFile);

export type SystemStatus = {
  serverWorkingDirectory: string;
  codex: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  claude: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  figma: {
    configured: boolean;
    enabled: boolean;
    authenticated?: boolean;
    detail: string;
    claudeConfigured: boolean;
    claudeAuthenticated?: boolean;
    claudeDetail: string;
  };
};

type FigmaCodexStatus = Pick<
  SystemStatus["figma"],
  "configured" | "enabled" | "authenticated" | "detail"
>;

export async function getSystemStatus(): Promise<SystemStatus> {
  const [codexVersion, claudeVersion, codexAuth, claudeAuth, mcpList, claudeFigma] =
    await Promise.all([
      runtimeVersion("codex"),
      runtimeVersion("claude"),
      runCli("codex", ["login", "status"], 20_000),
      runCli("claude", ["auth", "status", "--json"]),
      runCli("codex", ["mcp", "list", "--json"]),
      runCli("claude", ["mcp", "list"]),
    ]);

  const claudeAuthValue = parseJson(claudeAuth.stdout);
  const codexAuthOutput = `${codexAuth.stdout}\n${codexAuth.stderr}`.trim();
  const codexAuthenticated = isCodexAuthenticated(codexAuth, codexAuthOutput);
  const figma = findFigmaServer(parseJson(mcpList.stdout));
  const claudeFigmaOutput = `${claudeFigma.stdout}\n${claudeFigma.stderr}`;
  const claudeFigmaConfigured = claudeFigma.ok && /figma/i.test(claudeFigmaOutput);
  const claudeFigmaAuthenticated =
    claudeFigmaConfigured && /figma[^\r\n]*(connected|✓)/i.test(claudeFigmaOutput)
      ? true
      : undefined;
  return {
    serverWorkingDirectory: resolve(process.cwd()),
    codex: {
      installed: Boolean(codexVersion),
      ...(codexVersion ? { version: codexVersion } : {}),
      authenticated: codexAuthenticated,
      detail: !codexVersion
        ? "Codex CLI 실행 파일을 찾지 못했습니다."
        : codexAuthenticated
          ? cleanDetail(codexAuthOutput, "로그인됨")
          : cleanDetail(codexAuthOutput, "로그인이 필요합니다."),
    },
    claude: {
      installed: Boolean(claudeVersion),
      ...(claudeVersion ? { version: claudeVersion } : {}),
      authenticated: claudeAuth.ok && claudeAuthValue?.loggedIn === true,
      detail: !claudeVersion
        ? "Claude CLI 실행 파일을 찾지 못했습니다."
        : claudeAuth.ok && claudeAuthValue?.loggedIn === true
          ? `로그인됨${typeof claudeAuthValue.authMethod === "string" ? ` · ${claudeAuthValue.authMethod}` : ""}`
          : "로그인이 필요합니다.",
    },
    figma: {
      ...figma,
      claudeConfigured: claudeFigmaConfigured,
      ...(claudeFigmaAuthenticated !== undefined
        ? { claudeAuthenticated: claudeFigmaAuthenticated }
        : {}),
      claudeDetail: !claudeFigmaConfigured
        ? "Claude에 Figma 연결이 등록되지 않았습니다."
        : claudeFigmaAuthenticated
          ? "Claude용 Figma 연결이 준비되었습니다."
          : "Claude에 등록되어 있습니다. Claude에서 /mcp를 열어 로그인을 확인해 주세요.",
    },
  };
}

type CommandResult = { ok: boolean; stdout: string; stderr: string };

async function runCli(
  runtime: "codex" | "claude",
  args: string[],
  timeout = 8_000,
): Promise<CommandResult> {
  const executable = process.platform === "win32" ? `${runtime}.cmd` : runtime;
  try {
    const command =
      process.platform === "win32"
        ? ([
            process.env.ComSpec ?? "cmd.exe",
            ["/d", "/s", "/c", [executable, ...args].join(" ")],
          ] as const)
        : ([executable, args] as const);
    const result = await execFileAsync(command[0], command[1], {
      windowsHide: true,
      timeout,
      env: runtimeEnvironment(),
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

function isCodexAuthenticated(result: CommandResult, output: string): boolean {
  if (/\b(not logged in|not authenticated|login required)\b/i.test(output)) return false;
  return result.ok || /\b(logged in using|authenticated)\b/i.test(output);
}

function parseJson(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function findFigmaServer(value: Record<string, unknown> | undefined): FigmaCodexStatus {
  if (!value)
    return {
      configured: false,
      enabled: false,
      detail: "Codex에 Figma MCP가 등록되지 않았습니다.",
    };
  const rawServers = Array.isArray(value)
    ? value
    : Array.isArray(value.servers)
      ? value.servers
      : [];
  const server = rawServers.find((entry) => {
    const item = entry as Record<string, unknown>;
    return String(item.name ?? item.id ?? "").toLowerCase() === "figma";
  }) as Record<string, unknown> | undefined;
  if (!server) {
    const keyed = value.figma;
    if (keyed && typeof keyed === "object") return figmaStatus(keyed as Record<string, unknown>);
    return {
      configured: false,
      enabled: false,
      detail: "Codex에 Figma MCP가 등록되지 않았습니다.",
    };
  }
  return figmaStatus(server);
}

function figmaStatus(server: Record<string, unknown>): FigmaCodexStatus {
  const enabled = server.enabled !== false;
  const rawAuth = String(server.auth_status ?? server.authStatus ?? "");
  const authenticated = rawAuth
    ? !/(not[_ -]?logged|unauthenticated|login[_ -]?required|missing)/i.test(rawAuth)
    : undefined;
  return {
    configured: true,
    enabled,
    ...(authenticated !== undefined ? { authenticated } : {}),
    detail: !enabled
      ? "Figma MCP가 비활성화되어 있습니다."
      : authenticated === true
        ? "Figma MCP가 등록되고 인증되어 있습니다."
        : authenticated === false
          ? "Figma MCP는 등록됐지만 로그인이 필요합니다."
          : "Figma MCP가 등록되어 있습니다. OAuth 상태는 로그인 명령으로 확인해 주세요.",
  };
}

function cleanDetail(value: string, fallback: string): string {
  return value.trim().split(/\r?\n/).find(Boolean)?.slice(0, 200) || fallback;
}
