import { createGlobalStyle } from "styled-components";

export const AppGlobalStyles = createGlobalStyle`
  .panel,
  .office-card {
    border: 2px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surface};
    box-shadow: ${({ theme }) => theme.shadow};
  }

  .office-card {
    margin-bottom: 24px;
    padding: 20px;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .section-heading h2 {
    margin: 4px 0 0;
    font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
    letter-spacing: -0.025em;
  }

  .section-heading.compact {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};
  }

  .section-heading.compact h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: ${({ theme }) => theme.typography.fontSize.subtitle};
  }

  .section-heading.compact > span,
  .count {
    padding: 4px 8px;
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.positive};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  .office-canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .office-loading {
    display: grid;
    min-height: 360px;
    place-items: center;
    border: 3px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  .page-loading {
    display: grid;
    min-height: 45vh;
    place-items: center;
    color: ${({ theme }) => theme.colors.text.muted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  button:disabled {
    opacity: 0.47;
    cursor: not-allowed;
  }

  .field {
    display: grid;
    min-width: 145px;
    gap: 8px;
  }

  .field.grow {
    flex: 1;
  }

  .field label,
  fieldset legend {
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    letter-spacing: 0.04em;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  fieldset legend {
    margin-bottom: 8px;
  }

  .prompt-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .prompt-suggestions button {
    padding: 4px 8px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surface};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    text-align: left;
    cursor: pointer;
  }

  .prompt-suggestions button:hover {
    border-color: ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.positive};
  }

  .back-button {
    padding: 0;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.muted};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  }

  .technical-details {
    margin: 12px 0;
    border-top: 1px dashed ${({ theme }) => theme.colors.border.subtle};
    border-bottom: 1px dashed ${({ theme }) => theme.colors.border.subtle};
  }

  .technical-details > summary {
    padding: 8px 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  }

  .technical-details > .field {
    padding-bottom: 12px;
  }

  @media ${({ theme }) => theme.mediaQuery.mobile} {
    .office-card {
      padding: 12px;
    }
  }
`;
