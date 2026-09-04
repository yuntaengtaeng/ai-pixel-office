export const space = {
  xxs: "4px",
  xs: "8px",
  sm: "12px",
  md: "16px",
  ml: "20px",
  lg: "24px",
  l: "28px",
  xl: "32px",
} as const;

export type SpaceKey = keyof typeof space;
