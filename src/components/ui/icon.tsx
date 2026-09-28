import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors, type ColorToken } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = 'textPrimary' }: { name: IconName; size?: number; color?: ColorToken }) {
  return <Ionicons name={name} size={size} color={colors[color]} />;
}
