import "styled-components";
import type { OfficeTheme } from "@ai-pixel-office/design-token";

declare module "styled-components" {
  export interface DefaultTheme extends OfficeTheme {}
}
