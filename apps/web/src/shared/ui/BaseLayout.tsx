import { mediaQuery } from "@ai-pixel-office/design-system";
import styled from "styled-components";

/**
 * The padded, max-width content frame most pages want. This lives INSIDE
 * each page (wrapping that page's own returned JSX), not around the whole
 * app shell — a page that needs full-bleed content or a sticky region of
 * its own can simply render without it instead of fighting an ancestor's
 * fixed padding.
 */
export const BaseLayout = styled.div`
  width: min(1220px, 100%);
  padding: ${({ theme }) => `${theme.space.x11} ${theme.space.x12} ${theme.space.x18}`};
  margin: 0 auto;

  @media ${mediaQuery.md} {
    padding: ${({ theme }) => `${theme.space.x7} ${theme.space.x4} ${theme.space.x14}`};
  }
`;
