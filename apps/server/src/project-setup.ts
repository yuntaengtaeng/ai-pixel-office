import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { locateProjectRepository } from "./project-snapshot.ts";
import {
  detectPackageManager,
  suggestVerificationCommands,
  type PackageScripts,
} from "./request-engine/verification.ts";

export type ProjectSetupSuggestions = {
  /** 작업 공간으로 격리해 실행할 수 있는지 (Git 저장소인지) */
  isolated: boolean;
  setupCommand?: string;
  verificationCommands: string[];
  copyFiles: string[];
};

const ENV_FILE = /^\.env(\.[\w-]+)?$/;
const ENV_TEMPLATE = /\.(example|sample|template|dist)$/;

/** 작업 공간에 없을 로컬 환경 파일 (예시 파일 제외) */
export function envFilesToCopy(fileNames: string[]): string[] {
  return fileNames.filter((name) => ENV_FILE.test(name) && !ENV_TEMPLATE.test(name)).sort();
}

/** 프로젝트 폴더를 읽어 확인 방법, 준비 명령, 복사할 파일 제안 */
export async function suggestProjectSetup(projectPath: string): Promise<ProjectSetupSuggestions> {
  const fileNames = await readdir(projectPath).catch(() => [] as string[]);
  const isolated = (await locateProjectRepository(projectPath)) !== undefined;
  const detected = detectPackageManager(fileNames);
  const scripts = detected ? await readPackageScripts(projectPath) : {};
  return {
    isolated,
    ...(detected ? { setupCommand: detected.setupCommand } : {}),
    verificationCommands: detected
      ? suggestVerificationCommands(scripts, detected.packageManager)
      : [],
    copyFiles: envFilesToCopy(fileNames),
  };
}

async function readPackageScripts(projectPath: string): Promise<PackageScripts> {
  try {
    const parsed = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8")) as {
      scripts?: unknown;
    };
    if (typeof parsed.scripts !== "object" || parsed.scripts === null) return {};
    return Object.fromEntries(
      Object.entries(parsed.scripts).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}
