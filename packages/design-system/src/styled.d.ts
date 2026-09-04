import "styled-components";
import type { OfficeTheme } from "./tokens.ts";

declare module "styled-components" {
  export interface DefaultTheme extends OfficeTheme {}
}
