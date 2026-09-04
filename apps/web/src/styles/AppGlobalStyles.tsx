import { createGlobalStyle } from "styled-components";

export const AppGlobalStyles = createGlobalStyle`
  button:disabled {
    opacity: 0.47;
    cursor: not-allowed;
  }
`;
