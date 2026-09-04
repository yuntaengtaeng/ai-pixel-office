export const radius = {
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "10px",
  pill: "9999px",
  circle: "50%",
} as const;

export type Radius = typeof radius;
