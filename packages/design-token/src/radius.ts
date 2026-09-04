export const radius = {
  minimal: "2px",
  subtle: "4px",
  standard: "6px",
  comfortable: "8px",
  medium: "10px",
  pill: "999px",
  fullPill: "9999px",
  circle: "50%",
} as const;

export type Radius = typeof radius;
