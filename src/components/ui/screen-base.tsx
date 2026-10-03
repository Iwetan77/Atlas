import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '@/components/ui/back-header';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, radii, spacing } from '@/theme';

// `onRefresh`: pulling the screen down runs it, with a spinner while `refreshing`.
// `stickyTitle`: once the screen's own back button and title scroll away, a slim bar with them
// fades in at the top, so leaving never means scrolling back up.
type Props = ViewProps & { scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; stickyTitle?: string };

// Every screen keeps what you're typing in sight: a scrolling screen moves the focused field above
// the keyboard (iOS insets for it, then scrolls it into view); a fixed one shrinks to make room.
export function Screen({ scroll = true, refreshing = false, onRefresh, stickyTitle, children, style, ...rest }: Props) {
  const content = <View style={[styles.content, style]} {...rest}>{children}</View>;
  const [scrolled, setScrolled] = useState(false);
  const scroller = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      scrollEventThrottle={stickyTitle === undefined ? undefined : 32}
      onScroll={
        stickyTitle === undefined
          ? undefined
          : (e) => {
              const past = e.nativeEvent.contentOffset.y > 56;
              if (past !== scrolled) setScrolled(past);
            }
      }
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
  ) : null;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {scroller && stickyTitle !== undefined ? (
        <View style={styles.root}>
          {scroller}
          <StickyBar title={stickyTitle} visible={scrolled} />
        </View>
      ) : scroller ? (
        scroller
      ) : (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function StickyBar({ title, visible }: { title: string; visible: boolean }) {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, shown]);
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.bar, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
      <View style={styles.barInner}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.barBack, pressed && { backgroundColor: colors.accentPinkDim }]}>
          <Icon name="chevron-back" size={18} color="accentPink" />
        </Pressable>
        <Text variant="heading" numberOfLines={1} style={styles.barTitle}>
          {title}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgBase,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barInner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  barBack: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTitle: {
    flex: 1,
  },
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
