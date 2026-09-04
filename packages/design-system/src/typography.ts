import styled, { css } from "styled-components";
import { fontFamily, fontSize, fontWeight, lineHeight } from "@ai-pixel-office/design-token";

/**
 * `Text.*` keeps a line-height, for body copy that can wrap onto more than
 * one line (paragraphs, descriptions, list items).
 *
 * `Label.*` deliberately has no line-height. A line-height reserves leading
 * space above/below the glyphs, which throws off vertical centering when a
 * label sits next to an icon in a flex row (buttons, inputs, badges/pills).
 * Center those rows with the flex container's `align-items: center` instead
 * of the text's own line box.
 */
export const Text = {
  body: css`
    font-family: ${fontFamily.base};
    font-size: ${fontSize.md};
    font-weight: ${fontWeight.regular};
    line-height: ${lineHeight.normal};
  `,
  bodyStrong: css`
    font-family: ${fontFamily.base};
    font-size: ${fontSize.md};
    font-weight: ${fontWeight.black};
    line-height: ${lineHeight.normal};
  `,
  caption: css`
    font-family: ${fontFamily.base};
    font-size: ${fontSize.sm};
    font-weight: ${fontWeight.bold};
    line-height: ${lineHeight.loose};
  `,
};

export const Label = {
  md: css`
    font-family: ${fontFamily.base};
    font-size: ${fontSize.lg};
    font-weight: ${fontWeight.black};
  `,
  sm: css`
    font-family: ${fontFamily.base};
    font-size: ${fontSize.sm};
    font-weight: ${fontWeight.black};
  `,
  mono: css`
    font-family: ${fontFamily.mono};
    font-size: ${fontSize.sm};
    font-weight: ${fontWeight.black};
  `,
};

export const Kicker = styled.span`
  ${Label.mono}
  color: ${({ theme }) => theme.colors.text.secondary};
  letter-spacing: 0.13em;
  text-transform: uppercase;
`;

export const HelperText = styled.p`
  ${Text.caption}
  margin: -4px 0 15px;
  color: ${({ theme }) => theme.colors.text.muted};
`;
