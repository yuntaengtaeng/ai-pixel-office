export const fontFamily = {
  base: 'Inter, Pretendard, "Noto Sans KR", system-ui, -apple-system, sans-serif',
  mono: 'Consolas, Menlo, "Liberation Mono", monospace',
} as const;

/**
 * Raw type-scale values only (size/weight/lineHeight as numbers or px strings).
 * `packages/ui` turns these into actual `css` snippets — a "Text" family that
 * keeps lineHeight for body copy, and a "Label" family that drops it, since
 * icon+text rows (buttons, inputs, badges) need the icon and text to share a
 * center line rather than sit inside the text's own line box.
 */
export const fontSize = {
  xs: "8px",
  micro: "9px",
  sm: "10px",
  compact: "11px",
  md: "12px",
  base: "13px",
  lg: "14px",
  lead: "15px",
  subtitle: "16px",
  title: "17px",
  xl: "18px",
  headingSm: "19px",
  headingMd: "20px",
  headingLg: "21px",
  headingXl: "22px",
  heading2xl: "23px",
  displayXs: "24px",
  displaySm: "30px",
  displayMd: "34px",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  bold: 700,
  black: 800,
  heavy: 900,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  loose: 1.6,
} as const;

export type FontSizeKey = keyof typeof fontSize;
export type FontWeightKey = keyof typeof fontWeight;
