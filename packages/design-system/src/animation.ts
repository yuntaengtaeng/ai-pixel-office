import { keyframes } from "styled-components";
import { duration, easing } from "@ai-pixel-office/design-token";

export { duration, easing };

/** Overlay/backdrop entrance — dialogs, popovers. */
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
`;

/** Dialog/panel entrance — pairs with `fadeIn` on its backdrop. */
export const popIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.98);
  }
`;

/** Snackbar/toast entrance — slides up while fading in. */
export const slideUpIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
`;

/** Pixel-height pulse — "agent is working" indicator bars. */
export const pixelWork = keyframes`
  from {
    height: 8px;
    opacity: 0.45;
  }
  to {
    height: 31px;
    opacity: 1;
  }
`;
