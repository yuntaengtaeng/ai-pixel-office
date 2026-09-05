const HAS_BATCHIM_JOSA: Record<string, [string, string]> = {
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "을/를": ["을", "를"],
  "과/와": ["과", "와"],
};

export function josa(word: string, type: keyof typeof HAS_BATCHIM_JOSA): string {
  const [withBatchim, withoutBatchim] = HAS_BATCHIM_JOSA[type];
  const lastChar = word.trim().at(-1);
  if (!lastChar) return withoutBatchim;
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return withoutBatchim;
  const hasBatchim = (code - 0xac00) % 28 !== 0;
  return hasBatchim ? withBatchim : withoutBatchim;
}
