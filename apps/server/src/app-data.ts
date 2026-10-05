import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** 앱 소유 폴더의 내용 전체 삭제 (폴더 자체는 남김) */
export async function clearAppOwnedDirectories(directories: string[]): Promise<void> {
  for (const directory of new Set(directories)) {
    const entries = await readdir(directory).catch(() => []);
    await Promise.all(
      entries.map((entry) =>
        rm(join(directory, entry), { recursive: true, force: true }).catch(() => undefined),
      ),
    );
    await mkdir(directory, { recursive: true });
  }
}
