export const color = {
  ink: "#453d38",
  muted: "#847a72",
  canvas: "#eee7dc",
  cream: "#fffaf0",
  green: "#4e8874",
  greenDark: "#386758",
  blue: "#4d7f8a",
  red: "#c85f58",
  warning: "#f2c66f",
} as const;

export type ColorKey = keyof typeof color;
export type ColorValue = (typeof color)[ColorKey];
