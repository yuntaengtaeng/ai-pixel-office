import styled from "styled-components";
import { fieldLabelStyles } from "./Field.tsx";

export const Fieldset = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
`;

export const Legend = styled.legend`
  ${fieldLabelStyles}
  margin-bottom: ${({ theme }) => theme.space.x2};
`;
