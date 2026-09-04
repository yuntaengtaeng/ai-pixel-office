/// <reference types="vite/client" />

type DesktopRuntime = "codex" | "claude";

type InstallRuntimeResult = { ok: true } | { ok: false; message: string };

type PixelOfficeDesktopApi = {
  isDesktop: true;
  platform: NodeJS.Platform;
  connectRuntime(runtime: DesktopRuntime): Promise<{ started: true }>;
  installRuntime(runtime: DesktopRuntime): Promise<InstallRuntimeResult>;
};

interface Window {
  pixelOffice?: PixelOfficeDesktopApi;
}
