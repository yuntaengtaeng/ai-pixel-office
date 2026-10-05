export const radius = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "14px",
  pill: "9999px",
  circle: "50%",
} as const;

export type Radius = typeof radius;
