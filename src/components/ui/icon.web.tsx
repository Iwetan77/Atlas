import { Ionicons } from '@expo/vector-icons';
import type { IconName } from './icon';
import { colors, type ColorToken } from '@/theme';
export type { IconName } from './icon';

// The button/link supplies its readable label; decorative font glyphs stay out of that name.
export function Icon({ name, size = 20, color = 'textPrimary' }: { name: IconName; size?: number; color?: ColorToken }) {
  return <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}><Ionicons name={name} size={size} color={colors[color]} /></span>;
}
