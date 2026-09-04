import styled, { css } from "styled-components";
import { Label } from "./typography.ts";

export const fieldLabelStyles = css`
  ${Label.mono}
  color: ${({ theme }) => theme.colors.text.secondary};
  letter-spacing: 0.04em;
`;

export const Field = styled.div<{ $grow?: boolean }>`
  display: grid;
  min-width: 145px;
  gap: ${({ theme }) => theme.space.x2};
  ${({ $grow }) => $grow && css`flex: 1;`}

  label {
    ${fieldLabelStyles}
  }
`;
