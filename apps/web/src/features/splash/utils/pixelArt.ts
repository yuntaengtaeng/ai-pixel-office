/**
 * 문자 격자를 CSS box-shadow 픽셀 그림으로 바꿈
 * 그림을 받는 요소는 한 칸 크기이며, 모든 칸을 한 칸씩 오른쪽 아래로 밀어 요소 자신에 가려지지 않게 함
 * palette에 없는 문자(예: ".")는 빈칸
 */
export function pixelShadow(rows: string[], unit: number, palette: Record<string, string>): string {
  const pixels: string[] = [];
  rows.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      const color = palette[cell];
      if (!color) return;
      pixels.push(`${(columnIndex + 1) * unit}px ${(rowIndex + 1) * unit}px 0 0 ${color}`);
    });
  });
  return pixels.join(", ");
}
