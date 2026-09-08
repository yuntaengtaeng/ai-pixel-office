import { mediaQuery, pixelWork } from "@ai-pixel-office/design-system";
import styled from "styled-components";

const Loader = styled.div`
  display: grid;
  place-content: center;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x3};
  text-align: center;
  strong {
    color: ${({ theme }) => theme.colors.text.positive};
    font-size: ${({ theme }) => theme.typography.fontSize.title};
  }
  p {
    max-width: 420px;
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    line-height: 1.6;
  }
`;
const Pixels = styled.div`
  display: flex;
  align-items: end;
  gap: ${({ theme }) => theme.space.x1};
  height: 34px;
  span {
    width: 10px;
    height: 10px;
    background: ${({ theme }) => theme.colors.brand.primary};
    animation: ${pixelWork} 0.9s infinite alternate;
  }
  span:nth-child(2) {
    animation-delay: 0.15s;
  }
  span:nth-child(3) {
    animation-delay: 0.3s;
  }
  span:nth-child(4) {
    animation-delay: 0.45s;
  }
  @media ${mediaQuery.reducedMotion} {
    span {
      animation: none;
    }
  }
`;

export function PixelWorkLoader({ title, description }: { title: string; description: string }) {
  return (
    <Loader role="status" aria-live="polite">
      <Pixels aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </Pixels>
      <strong>{title}</strong>
      <p>{description}</p>
    </Loader>
  );
}
