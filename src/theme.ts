// Single source of truth for Atlas design tokens. Components never hard-code colors.

export const colors = {
  // MiniPay's slate greys, sampled from their app: grey carries the layout, pink carries the brand.
  bgBase: '#292C33',
  bgSurface: '#444557',
  bgSurfaceAlt: '#4F5165',
  bgTabBar: '#333544',
  // Darkest point of art gradients (share cards).
  bgDeep: '#120C10',

  accentPink: '#FF2E7E',
  accentPinkTint: '#FF8AB5',
  // Hero card shades (MiniPay's green relationships, in pink): deeper pink for the pills on the card,
  // a lighter wash for the decorative circle.
  accentPinkDeep: '#D81B64',
  accentPinkWash: '#FF4A90',
  // Muted dark pink for promos, chips and the chevron tab (MiniPay's dark green).
  accentPinkDim: '#6A2F46',
  accentPinkMuted: '#5A273B',

  // Pastel icon tiles, with the dark ink that sits on them.
  tilePink: '#F5B3CC',
  tilePinkInk: '#8A1142',
  tileBlue: '#B9C6F7',
  tileBlueInk: '#23306B',

  textPrimary: '#FFFFFF',
  textSecondary: '#B4B6C4',
  textDisabled: '#7C7E8E',
  // Text on a pink fill.
  textOnAccent: '#FFFFFF',
  // Text on white surfaces (light buttons, asset cards on the hero).
  textOnLight: '#1D1F26',
  surfaceLight: '#FFFFFF',
  // Dimmed backdrop behind bottom sheets.
  scrim: 'rgba(0,0,0,0.6)',
  // Translucent white for chips and dividers drawn on the pink hero card.
  onAccentSoft: 'rgba(255,255,255,0.22)',

  // Semantic colors stay away from the brand pink so gains/losses never read as branding.
  success: '#3DDC84',
  successDim: '#23473A',
  danger: '#FF7A52',
  dangerDim: '#4A2E2A',

  // QR codes stay dark-on-white: plenty of camera scanners can't read inverted codes.
  qrBackground: '#FFFFFF',

  // Outlined cards (MiniPay's Next steps card) and dividers.
  border: '#474A5C',
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


// Web renders the phone layout centered instead of stretching it across a desktop screen.
export const maxContentWidth = 520;

export const theme = { colors, spacing, radii, fonts, type, maxContentWidth } as const;
