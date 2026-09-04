import { color } from "./color.ts";
import { space } from "./space.ts";
import { shadow } from "./shadow.ts";
import { fontFamily, fontSize, fontWeight, lineHeight } from "./typography.ts";
import { duration, easing } from "./animation.ts";

export const officeTheme = {
  colors: color,
  space,
  shadow,
  typography: { fontFamily, fontSize, fontWeight, lineHeight },
  animation: { duration, easing },
} as const;

export type OfficeTheme = typeof officeTheme;
