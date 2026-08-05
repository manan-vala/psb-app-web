/**
 * Design tokens ported 1:1 from the Expo app's `constants/theme.ts`.
 * These are mirrored as CSS custom properties in `src/app/globals.css`;
 * this module exists for the handful of places that need a token in JS
 * (inline styles, canvas colours, dynamic values).
 */

export const Colors = {
  primary: '#FF6600',
  primaryContainer: '#FF8533',
  primaryFixed: '#ffdbd0',
  primaryFixedDim: '#ffb59e',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fffbff',
  secondary: '#485e8a',
  secondaryContainer: '#b5ccfe',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#3f5681',
  tertiary: '#605b57',
  tertiaryContainer: '#79746f',
  onTertiary: '#ffffff',
  background: '#fbf9f8',
  surface: '#fbf9f8',
  surfaceDim: '#dbd9d9',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f3f3',
  surfaceContainer: '#efeded',
  surfaceContainerHigh: '#eae8e7',
  surfaceContainerHighest: '#e4e2e2',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#5b4138',
  outline: '#8f7067',
  outlineVariant: '#e4beb3',
  inverseSurface: '#303030',
  inverseOnSurface: '#f2f0f0',
  surfaceTint: '#ad3300',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  success: '#16a34a',
  successLight: '#4ade80',
  warning: '#facc15',
} as const;

export const Spacing = {
  stackSm: 8,
  stackMd: 16,
  stackLg: 24,
  marginMobile: 16,
  gutter: 16,
} as const;

export const BorderRadius = {
  sm: 4,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;
