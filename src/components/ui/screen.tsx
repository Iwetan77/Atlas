import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, maxContentWidth, spacing } from '@/theme';

// `onRefresh`: pulling the screen down runs it, with a spinner while `refreshing`.
type Props = ViewProps & { scroll?: boolean; refreshing?: boolean; onRefresh?: () => void };

// Every screen keeps what you're typing in sight: a scrolling screen moves the focused field above
// the keyboard (iOS insets for it, then scrolls it into view); a fixed one shrinks to make room.
export function Screen({ scroll = true, refreshing = false, onRefresh, children, style, ...rest }: Props) {
  const content = <View style={[styles.content, style]} {...rest}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accentPink}
                colors={[colors.accentPink]}
                progressBackgroundColor={colors.bgSurface}
              />
            ) : undefined
          }>
          {content}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
});
