import Ionicons from '@expo/vector-icons/Ionicons';
import { useContext, type ComponentProps } from 'react';

import { colors, PaletteContext, type ColorToken } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = 'textPrimary' }: { name: IconName; size?: number; color?: ColorToken }) {
  const palette = useContext(PaletteContext) ?? colors;
  return <Ionicons name={name} size={size} color={palette[color]} />;
}
