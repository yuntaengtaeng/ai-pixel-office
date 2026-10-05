import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runtimeEnvironment } from "../../../scripts/runtime-spike/process.ts";

const execFileAsync = promisify(execFile);

/** 줄바꿈 변환 없이 파일 내용을 그대로 다루는 Git 옵션 */
const GIT_OPTIONS = [
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.safecrlf=false",
  "-c",
  "core.quotepath=false",
  "-c",
  "core.longpaths=true",
];
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;

/** 앱이 만드는 커밋 객체의 작성자 (사용자 Git 설정에 이름이 없어도 동작하도록) */
export const PIXEL_OFFICE_GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Pixel Office",
  GIT_AUTHOR_EMAIL: "pixel-office@localhost",
  GIT_COMMITTER_NAME: "Pixel Office",
  GIT_COMMITTER_EMAIL: "pixel-office@localhost",
};

/** Git 실행 (로그인 셸 PATH 위에 extraEnv를 덧씀) */
export async function runGit(
  cwd: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<string> {
  const { stdout } = await execFileAsync("git", [...GIT_OPTIONS, ...args], {
    cwd,
    env: { ...runtimeEnvironment(), ...extraEnv },
    windowsHide: true,
    maxBuffer: MAX_GIT_OUTPUT,
  });
  return stdout;
}
