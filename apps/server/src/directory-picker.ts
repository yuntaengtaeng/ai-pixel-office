import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DomainError } from "../../../packages/domain/src/index.ts";

const execFileAsync = promisify(execFile);

export async function pickDirectory(startPath?: string): Promise<string | undefined> {
  try {
    if (process.platform === "win32") {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
        "$dialog.Description = 'AI Pixel Office 프로젝트 폴더 선택'",
        "if ($args[0] -and (Test-Path -LiteralPath $args[0])) { $dialog.SelectedPath = $args[0] }",
        "if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }",
        "$bytes = [System.Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)",
        "[Convert]::ToBase64String($bytes)",
      ].join("; ");
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script, startPath ?? ""],
        { windowsHide: true, timeout: 120_000 },
      );
      const encoded = stdout.trim().split(/\r?\n/).at(-1);
      return encoded ? Buffer.from(encoded, "base64").toString("utf8") : undefined;
    }
    if (process.platform === "darwin") {
      const { stdout } = await execFileAsync(
        "osascript",
        ["-e", 'POSIX path of (choose folder with prompt "AI Pixel Office 프로젝트 폴더 선택")'],
        { timeout: 120_000 },
      );
      return stdout.trim().replace(/\/$/, "") || undefined;
    }
    const { stdout } = await execFileAsync(
      "zenity",
      ["--file-selection", "--directory", "--title=AI Pixel Office 프로젝트 폴더 선택"],
      { timeout: 120_000 },
    );
    return stdout.trim() || undefined;
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code === 1 || code === 2) return undefined;
    throw new DomainError(
      "DIRECTORY_PICKER_FAILED",
      "폴더 선택기를 열 수 없습니다. 경로를 직접 입력해 주세요.",
      500,
    );
  }
}
