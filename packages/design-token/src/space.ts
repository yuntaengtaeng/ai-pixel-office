export const space = {
  x1: "4px",
  x2: "8px",
  x3: "12px",
  x4: "16px",
  x5: "20px",
  x6: "24px",
  x7: "28px",
  x8: "32px",
  x11: "44px",
  x12: "48px",
  x14: "56px",
  x18: "72px",
} as const;

export type SpaceKey = keyof typeof space;
