import { colors } from "./color.ts";

export const shadow = "none" as const;

/** Dialog, Popover처럼 떠 있는 층의 그림자 */
export const floatingShadow = `0 16px 40px ${colors.shadow.default}` as const;
