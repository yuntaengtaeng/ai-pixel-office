export const space = {
  xs: "6px",
  sm: "10px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;

export type SpaceKey = keyof typeof space;
