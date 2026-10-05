import { fontFamily } from "@ai-pixel-office/design-system";

const CANVAS_FONT_TIMEOUT_MS = 1_500;

/**
 * 캔버스 글자는 그릴 때 이미지로 굳으므로 웹 글꼴을 먼저 불러옴
 * 시간 안에 못 불러오면 대체 글꼴로 그림
 */
export async function loadCanvasFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const loading = Promise.all([
    document.fonts.load(`600 12px ${fontFamily.base}`),
    document.fonts.load(`700 14px ${fontFamily.base}`),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolveTimeout) =>
    setTimeout(resolveTimeout, CANVAS_FONT_TIMEOUT_MS),
  );
  await Promise.race([loading.catch(() => undefined), timeout]);
}
