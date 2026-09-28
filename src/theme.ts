// Single source of truth for Atlas design tokens. Components never hard-code colors.

export const colors = {
  // Surfaces stay black. Separation comes from pink borders, not from lifting the fill:
  // dark fills only get ~1.1:1 apart, which reads as one flat slab.
  bgBase: '#0A0A0D',
  bgSurface: '#141117',
  bgSurfaceAlt: '#1D1822',

  accentPink: '#FF2E7E',
  accentPinkTint: '#FF6FA5',
  accentPinkDim: '#2A0F1C',

  textPrimary: '#F5F3F6',
  textSecondary: '#9C96A3',
  textDisabled: '#6E6875',
  // Text sitting on an accentPink fill.
  textOnAccent: '#0A0A0D',

  // Semantic colors stay away from the brand pink so gains/losses never read as branding.
  success: '#3DDC84',
  danger: '#FF6A3D',

  // Card outlines (~1.5:1 on black). Interactive outlines use accentPink.
  border: '#5C1F3B',
} as const;

export type ColorToken = keyof typeof colors;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

// System font for v1.
export const type = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export type TypeVariant = keyof typeof type;

// Web renders the phone layout centered instead of stretching it across a desktop screen.
export const maxContentWidth = 520;

export const theme = { colors, spacing, radii, type, maxContentWidth } as const;
