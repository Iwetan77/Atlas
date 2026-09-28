import { Text as RNText, type TextProps } from 'react-native';

import { colors, type ColorToken, type TypeVariant, type as typeScale } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
};

export function Text({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  return <RNText style={[typeScale[variant], { color: colors[color] }, style]} {...rest} />;
}
