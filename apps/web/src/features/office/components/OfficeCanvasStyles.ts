import { createGlobalStyle } from "styled-components";

export const OfficeCanvasStyles = createGlobalStyle`
  .office-canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain;
    image-rendering: pixelated;
  }
`;
