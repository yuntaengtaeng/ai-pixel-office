import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 시작 장면이 끝날 때까지 true (움직임 줄이기 설정이면 처음부터 false) */
export function useSplashIntroPlaying(durationMs: number): boolean {
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, playing]);
  return playing;
}
