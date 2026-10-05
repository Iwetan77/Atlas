import { useContext } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { colors, PaletteContext, type ColorToken, type TypeVariant, type as typeScale } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
};

export function Text({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  const palette = useContext(PaletteContext) ?? colors;
  return <RNText style={[typeScale[variant], { color: palette[color] }, style]} {...rest} />;
}
