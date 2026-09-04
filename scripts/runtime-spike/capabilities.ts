import { CodexAppServerClient } from "./json-rpc.ts";
import { runtimeVersion } from "./process.ts";
import type { RuntimeCapabilities } from "./types.ts";

const codexCapabilities: RuntimeCapabilities = {
  nonInteractive: true,
  structuredEvents: true,
  toolEvents: true,
  interactiveApproval: true,
  resumableSession: true,
  cancellation: true,
  usageReporting: true,
  workingDirectory: true,
};

async function probeAppServer(): Promise<boolean> {
  const client = new CodexAppServerClient();
  try {
    client.start();
    await client.initialize();
    return true;
  } catch (error) {
    console.error(
      `App Server probe failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  } finally {
    await client.close();
  }
}

const [codexVersion, claudeVersion, appServerReady] = await Promise.all([
  runtimeVersion("codex"),
  runtimeVersion("claude"),
  probeAppServer(),
]);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      runtimes: {
        codex: {
          installed: Boolean(codexVersion),
          version: codexVersion,
          appServerReady,
          capabilities: codexCapabilities,
          evidence: "Codex App Server v2 protocol and local initialize handshake",
        },
        claude: {
          installed: Boolean(claudeVersion),
          version: claudeVersion,
          capabilities: "not-tested",
        },
      },
    },
    null,
    2,
  ),
);

if (!appServerReady) process.exitCode = 1;
