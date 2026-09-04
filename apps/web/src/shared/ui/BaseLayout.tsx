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
  padding: 44px 46px 70px;
  margin: 0 auto;

  @media (max-width: 760px) {
    padding: 26px 14px 55px;
  }
`;
