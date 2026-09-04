export const breakpoints = {
  mobileSmall: 425,
  mobile: 760,
  tablet: 896,
  desktopSmall: 1100,
  desktop: 1280,
} as const;

export const mediaQuery = {
  mobileSmall: `(max-width: ${breakpoints.mobileSmall}px)`,
  mobile: `(max-width: ${breakpoints.mobile}px)`,
  tablet: `(max-width: ${breakpoints.tablet}px)`,
  desktopSmall: `(max-width: ${breakpoints.desktopSmall}px)`,
  desktop: `(max-width: ${breakpoints.desktop}px)`,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type Breakpoints = typeof breakpoints;
export type MediaQuery = typeof mediaQuery;
