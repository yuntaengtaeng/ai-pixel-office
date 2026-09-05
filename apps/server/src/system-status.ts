import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { runtimeEnvironment, runtimeVersion } from "../../../scripts/runtime-spike/process.ts";

const execFileAsync = promisify(execFile);

export type McpServerStatus = {
  configured: boolean;
  enabled: boolean;
  authenticated?: boolean;
  detail: string;
};

export type McpIntegrationStatus = {
  codex: McpServerStatus;
  claude: McpServerStatus;
};

export type SystemStatus = {
  serverWorkingDirectory: string;
  codex: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  claude: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  mcp: Record<McpIntegrationName, McpIntegrationStatus>;
};

// 새 MCP 연동을 추가하려면 이 타입에 이름을 추가하고 아래 MCP_INTEGRATIONS에 항목 하나만
// 더하면 된다 — codex/claude CLI 호출은 이미 모든 등록된 MCP 서버를 한 번에 반환하므로
// 연동이 늘어나도 새 CLI 호출은 필요 없다.
export type McpIntegrationName = "figma";

type McpIntegrationConfig = {
  name: McpIntegrationName;
  codexServerName: string;
  codexNotFoundDetail: string;
  claudeNamePattern: RegExp;
  claudeAuthenticatedPattern: RegExp;
  claudeNotConfiguredDetail: string;
  claudeConfiguredDetail: string;
  claudeNeedsLoginDetail: string;
};

const MCP_INTEGRATIONS: McpIntegrationConfig[] = [
  {
    name: "figma",
    codexServerName: "figma",
    codexNotFoundDetail: "Codex에 Figma MCP가 등록되지 않았습니다.",
    claudeNamePattern: /figma/i,
    claudeAuthenticatedPattern: /figma[^\r\n]*(connected|✓)/i,
    claudeNotConfiguredDetail: "Claude에 Figma 연결이 등록되지 않았습니다.",
    claudeConfiguredDetail: "Claude용 Figma 연결이 준비되었습니다.",
    claudeNeedsLoginDetail: "Claude에 등록되어 있습니다. Claude에서 /mcp를 열어 로그인을 확인해 주세요.",
  },
];

export async function getSystemStatus(): Promise<SystemStatus> {
  const [codexVersion, claudeVersion, codexAuth, claudeAuth, codexMcpList, claudeMcpList] =
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
  const codexMcpValue = parseJson(codexMcpList.stdout);
  const claudeMcpOutput = `${claudeMcpList.stdout}\n${claudeMcpList.stderr}`;

  const mcp = Object.fromEntries(
    MCP_INTEGRATIONS.map((integration) => [
      integration.name,
      {
        codex: codexMcpStatus(codexMcpValue, integration),
        claude: claudeMcpStatus(claudeMcpOutput, integration),
      },
    ]),
  ) as Record<McpIntegrationName, McpIntegrationStatus>;

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
    mcp,
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

function codexMcpStatus(
  value: Record<string, unknown> | undefined,
  integration: McpIntegrationConfig,
): McpServerStatus {
  if (!value)
    return { configured: false, enabled: false, detail: integration.codexNotFoundDetail };
  const rawServers = Array.isArray(value)
    ? value
    : Array.isArray(value.servers)
      ? value.servers
      : [];
  const server = rawServers.find((entry) => {
    const item = entry as Record<string, unknown>;
    return String(item.name ?? item.id ?? "").toLowerCase() === integration.codexServerName;
  }) as Record<string, unknown> | undefined;
  if (!server) {
    const keyed = value[integration.codexServerName];
    if (keyed && typeof keyed === "object")
      return mcpServerStatusFromEntry(keyed as Record<string, unknown>);
    return { configured: false, enabled: false, detail: integration.codexNotFoundDetail };
  }
  return mcpServerStatusFromEntry(server);
}

function mcpServerStatusFromEntry(server: Record<string, unknown>): McpServerStatus {
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
      ? "MCP가 비활성화되어 있습니다."
      : authenticated === true
        ? "MCP가 등록되고 인증되어 있습니다."
        : authenticated === false
          ? "MCP는 등록됐지만 로그인이 필요합니다."
          : "MCP가 등록되어 있습니다. OAuth 상태는 로그인 명령으로 확인해 주세요.",
  };
}

function claudeMcpStatus(output: string, integration: McpIntegrationConfig): McpServerStatus {
  const configured = integration.claudeNamePattern.test(output);
  const authenticated = configured && integration.claudeAuthenticatedPattern.test(output)
    ? true
    : undefined;
  return {
    configured,
    enabled: configured,
    ...(authenticated !== undefined ? { authenticated } : {}),
    detail: !configured
      ? integration.claudeNotConfiguredDetail
      : authenticated
        ? integration.claudeConfiguredDetail
        : integration.claudeNeedsLoginDetail,
  };
}

function cleanDetail(value: string, fallback: string): string {
  return value.trim().split(/\r?\n/).find(Boolean)?.slice(0, 200) || fallback;
}
