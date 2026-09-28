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
  successDim: '#0F2A1C',
  danger: '#FF6A3D',

  // QR codes stay dark-on-white: plenty of camera scanners can't read inverted codes.
  qrBackground: '#FFFFFF',

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

// Space Grotesk for numbers and headings (gives the balance its character), Inter for reading text.
// Custom fonts need one family per weight on Android, so styles name the exact face, not a fontWeight.
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, letterSpacing: -1.2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof type;

export const gradients = {
  // Balance card: a pink glow falling off into black.
  balance: ['#4A1030', '#1A0B13', '#0F0A0E'],
  brand: ['#FF2E7E', '#C4155C'],
} as const;

// Web renders the phone layout centered instead of stretching it across a desktop screen.
export const maxContentWidth = 520;

export const theme = { colors, spacing, radii, fonts, type, gradients, maxContentWidth } as const;
