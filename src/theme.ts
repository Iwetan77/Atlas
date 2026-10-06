// Single source of truth for Atlas design tokens. Components never hard-code colors.
import { createContext } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { applyPageTheme, pageThemeBootstrap } from '@/web/page-appearance';

// Atlas's dark look (the original), and the light one: same brand pink, same meaning per token.
const dark = {
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
  // The plain third tile in a cluster: white on dark, soft grey on white cards.
  tileNeutral: '#FFFFFF',

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

  // The secondary (non-pink) button: white on dark, near-black on light, so it always stands out.
  buttonSecondary: '#FFFFFF',
  buttonSecondaryText: '#1D1F26',
};

export type ColorToken = keyof typeof dark;
export type Palette = Record<ColorToken, string>;

const light: Palette = {
  // Soft grey pages, white cards, a slightly deeper grey for bars, chips and tracks.
  bgBase: '#F4F5F8',
  bgSurface: '#FFFFFF',
  bgSurfaceAlt: '#E8E9EF',
  bgTabBar: '#ECEDF2',
  bgDeep: '#120C10',

  accentPink: '#FF2E7E',
  // Pink text and icons need more depth to read on white.
  accentPinkTint: '#D1135C',
  accentPinkDeep: '#D81B64',
  accentPinkWash: '#FF4A90',
  accentPinkDim: '#FFE3EE',
  accentPinkMuted: '#FFEEF4',

  tilePink: '#F5B3CC',
  tilePinkInk: '#8A1142',
  // Blue doubles as the "No" outcome's text: deep enough to read, with white ink on its tiles.
  tileBlue: '#4F63D2',
  tileBlueInk: '#FFFFFF',
  tileNeutral: '#E8E9EF',

  textPrimary: '#15161C',
  textSecondary: '#5D6173',
  textDisabled: '#A2A5B3',
  textOnAccent: '#FFFFFF',
  textOnLight: '#1D1F26',
  surfaceLight: '#FFFFFF',
  scrim: 'rgba(16,17,22,0.45)',
  onAccentSoft: 'rgba(255,255,255,0.22)',

  success: '#12994A',
  successDim: '#DDF4E6',
  danger: '#D9482B',
  dangerDim: '#FCE7E1',

  qrBackground: '#FFFFFF',
  border: '#DFE1E8',

  buttonSecondary: '#1A1B22',
  buttonSecondaryText: '#FFFFFF',
};

// Share cards are pictures people post: they keep the dark art whatever the app's theme.
export const darkColors: Palette = { ...dark };
// The light palette, for art that is always light (a receipt's pink header and its white pill).
export const lightColors: Palette = { ...light };

export type ThemeName = 'dark' | 'light';
const THEME_KEY = 'atlas.theme';
export const webThemeBootstrap = pageThemeBootstrap(THEME_KEY, { dark: dark.bgBase, light: light.bgBase });

// Read before any screen draws, so a light-mode user never sees a dark flash at start.
function savedTheme(): ThemeName {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage?.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const store = require('expo-secure-store') as typeof import('expo-secure-store');
    return store.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: ThemeName = savedTheme();

// The live palette. Its values change in place when the theme does; every lookup at render time
// (Text, Icon, inline styles, themedStyles) reads the current one.
export const colors: Palette = { ...(current === 'light' ? light : dark) };
if (Platform.OS === 'web') applyPageTheme(current, colors.bgBase);

const listeners = new Set<() => void>();

export function themeName(): ThemeName {
  return current;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Switches the whole app's look and remembers it on this device.
export function setTheme(next: ThemeName) {
  if (next === current) return;
  current = next;
  Object.assign(colors, next === 'light' ? light : dark);
  if (Platform.OS === 'web') applyPageTheme(next, colors.bgBase);
  try {
    if (Platform.OS === 'web') {
      window.localStorage?.setItem(THEME_KEY, next);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-secure-store') as typeof import('expo-secure-store')).setItem(THEME_KEY, next);
    }
  } catch {
    // Not remembered: it still applies until the app closes.
  }
  listeners.forEach((l) => l());
}

// A subtree drawn in a fixed palette (share cards): Text and Icon inside read it instead.
export const PaletteContext = createContext<Palette | null>(null);

// StyleSheet.create for styles that use colors: built for the theme in use when first read, and
// again (once) for the other theme, so a screen drawn after a switch gets the right colors.
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T {
  const built: Partial<Record<ThemeName, T>> = {};
  const now = () => (built[current] ??= StyleSheet.create(factory()));
  return new Proxy({} as T, {
    get: (_, key) => now()[key as keyof T],
    has: (_, key) => key in now(),
    ownKeys: () => Reflect.ownKeys(now()),
    getOwnPropertyDescriptor: (_, key) => ({ ...Reflect.getOwnPropertyDescriptor(now(), key), configurable: true }),
  });
}

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
