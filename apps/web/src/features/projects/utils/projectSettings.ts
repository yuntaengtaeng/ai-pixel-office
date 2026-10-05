/** 저장된 값과 제안을 합친 후보 (저장된 것 먼저, 같은 값은 한 번만) */
export function candidateValues(saved: string[], suggested: string[]): string[] {
  return [...new Set([...saved, ...suggested].map((value) => value.trim()).filter(Boolean))];
}

/** 목록에 값을 넣거나 빼기 (순서 유지) */
export function toggleValue(values: string[], value: string, included: boolean): string[] {
  const without = values.filter((item) => item !== value);
  return included ? [...without, value] : without;
}
