import type { ReactNode } from "react";
import { mediaQuery } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { Link } from "react-router-dom";

const Frame = styled.aside<{ $embedded: boolean }>`
  position: ${({ $embedded }) => ($embedded ? "relative" : "fixed")};
  inset: ${({ $embedded }) => ($embedded ? "auto" : "0 auto 0 0")};
  width: 228px;
  height: ${({ $embedded }) => ($embedded ? "100%" : "auto")};
  min-height: ${({ $embedded }) => ($embedded ? "0" : "100dvh")};
  padding: ${({ theme }) => `${theme.space.x6} ${theme.space.x5}`};
  background: ${({ theme }) => theme.colors.brand.primaryDark};
  color: ${({ theme }) => theme.colors.text.inverse};
  border: 0;
  border-right: 4px solid ${({ theme }) => theme.colors.brand.primary};
  display: flex;
  flex-direction: column;
  overflow-y: ${({ $embedded }) => ($embedded ? "visible" : "auto")};
  z-index: ${({ theme }) => theme.zIndex.navigation};

  @media ${mediaQuery.md} {
    position: sticky;
    inset: 0 auto auto;
    width: 100%;
    min-height: auto;
    height: auto;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    border: 0;
    border-bottom: 4px solid ${({ theme }) => theme.colors.brand.primary};
    flex-direction: row;
    align-items: center;
    overflow-y: visible;
  }
`;
const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x3};
  color: ${({ theme }) => theme.colors.text.inverse};
  font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  letter-spacing: -0.02em;
`;
const Mark = styled.span`
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  background: ${({ theme }) => theme.colors.semantic.warning};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 2px solid ${({ theme }) => theme.colors.border.strong};
  box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.title};
`;
const BrandLink = styled(Link)`
  color: inherit;
`;

export function OfficeSidebar({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  return <Frame $embedded={embedded}>{children}</Frame>;
}

export function OfficeBrand({ to, inverse = true }: { to?: string; inverse?: boolean }) {
  const content = (
    <Brand style={{ color: inverse ? undefined : "inherit" }}>
      <Mark aria-hidden="true">AO</Mark>
      <span>AI Pixel Office</span>
    </Brand>
  );
  return to ? <BrandLink to={to}>{content}</BrandLink> : content;
}
