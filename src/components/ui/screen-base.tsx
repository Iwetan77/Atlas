import { Children, createContext, isValidElement, type ReactElement, type ReactNode, useContext, useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '@/components/ui/back-header';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, radii, spacing, themedStyles } from '@/theme';

// `onRefresh`: pulling the screen down runs it, with a spinner while `refreshing`.
// `stickyTitle`: once the screen's own back button and title scroll away, a slim bar with them
// fades in at the top, so leaving never means scrolling back up.
type Props = ViewProps & { scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; stickyTitle?: string };

// Room above the pinned copy, so it never touches the screen's edge or the title bar.
const PINNED_GAP = spacing.sm;

// Where a screen's <Pinned> section sits in the scroll (its top, in content coordinates).
const PinnedSpot = createContext<((y: number) => void) | null>(null);

// A screen's search and filters: they scroll with the page until they reach the top, then stay
// there (a copy takes over at exactly that spot, under the slim title bar when there is one), so
// searching never means scrolling back up. Give it as a direct child of <Screen>.
export function Pinned({ children }: { children: ReactNode }) {
  const report = useContext(PinnedSpot);
  return (
    <View style={styles.pinned} onLayout={report ? (e) => report(e.nativeEvent.layout.y) : undefined}>
      {children}
    </View>
  );
}

// Every screen keeps what you're typing in sight: a scrolling screen moves the focused field above
// the keyboard (iOS insets for it, then scrolls it into view); a fixed one shrinks to make room.
export function Screen({ scroll = true, refreshing = false, onRefresh, stickyTitle, children, style, ...rest }: Props) {
  const [scrolled, setScrolled] = useState(false);
  // The pinned section: what's in it, where it sits, the title bar's height above it, and whether
  // it has reached the top.
  const pinned = Children.toArray(children).find(
    (c): c is ReactElement<{ children: ReactNode }> => isValidElement(c) && c.type === Pinned,
  );
  const [pinnedY, setPinnedY] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [viewport, setViewport] = useState(0);
  const watching = stickyTitle !== undefined || pinned !== undefined;
  // While pinned, the page keeps a screen's worth of room below the pinned spot: typing a search
  // that leaves a few results can't shorten it so much that the bar (and its keyboard) goes away.
  const room = stuck && pinnedY !== null && viewport > 0 ? { minHeight: pinnedY + viewport } : null;
  const content = <View style={[styles.content, style, room]} {...rest}>{children}</View>;
  const scroller = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      // Browsers re-anchor the scroll when the list above the fold changes, which threw the page back
      // to the top as a search narrowed it (and closed the pinned search). Phones don't do this.
      style={pinned && Platform.OS === 'web' ? ({ overflowAnchor: 'none' } as object) : undefined}
      onLayout={pinned ? (e) => setViewport(e.nativeEvent.layout.height) : undefined}
      scrollEventThrottle={watching ? 16 : undefined}
      onScroll={
        !watching
          ? undefined
          : (e) => {
              const y = e.nativeEvent.contentOffset.y;
              const past = y > 56;
              if (past !== scrolled) setScrolled(past);
              // Stuck once the section's top meets the bottom of the title bar (or the screen's top).
              const reached =
                pinned !== undefined &&
                pinnedY !== null &&
                y >= pinnedY - PINNED_GAP - (stickyTitle !== undefined && past ? barHeight : 0);
              if (reached !== stuck) setStuck(reached);
            }
      }
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      // On the web "on-drag" fires on any scroll, including the one a narrowing search causes, and
      // would drop the pinned search's cursor mid-word.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'web' && pinned ? 'none' : 'on-drag'}
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
      <PinnedSpot.Provider value={pinned ? setPinnedY : null}>{content}</PinnedSpot.Provider>
    </ScrollView>
  ) : null;
  const top = stickyTitle !== undefined && scrolled ? barHeight : 0;
  // The pinned copy lines up with the page's own column (wider on the desktop website).
  const column = StyleSheet.flatten(style);
  // Android draws edge to edge, so it no longer shrinks the app for the keyboard: the screen shrinks
  // itself to the space above it, and the scroller keeps the field being typed in visible. iOS
  // scrolling screens inset themselves (automaticallyAdjustKeyboardInsets); fixed ones pad.
  const avoid = Platform.OS === 'android' ? 'height' : Platform.OS === 'ios' && !scroller ? 'padding' : undefined;
  const body = scroller && watching ? (
        <View style={styles.root}>
          {scroller}
          {pinned && stuck ? (
            <View style={[styles.pinnedBar, { top }]}>
              <View
                style={[
                  styles.pinnedInner,
                  styles.pinned,
                  column?.maxWidth !== undefined && { maxWidth: column.maxWidth },
                  column?.paddingHorizontal !== undefined && { paddingHorizontal: column.paddingHorizontal },
                ]}>
                {pinned.props.children}
              </View>
            </View>
          ) : null}
          {stickyTitle !== undefined ? (
            <StickyBar title={stickyTitle} visible={scrolled} joined={pinned !== undefined && stuck} onHeight={setBarHeight} />
          ) : null}
        </View>
      ) : scroller ? (
        scroller
      ) : (
        content
      );
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {avoid ? <KeyboardAvoidingView style={styles.root} behavior={avoid}>{body}</KeyboardAvoidingView> : body}
    </SafeAreaView>
  );
}

// `joined`: the pinned search sits right under it, so the two read as one bar (one line, below both).
function StickyBar({
  title,
  visible,
  joined,
  onHeight,
}: {
  title: string;
  visible: boolean;
  joined: boolean;
  onHeight: (h: number) => void;
}) {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, shown]);
  return (
    <Animated.View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.bar, joined && styles.barJoined, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
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

const styles = themedStyles(() => ({
  pinned: {
    gap: spacing.md,
  },
  // The pinned copy: the page's own background, a hairline and a soft shadow, so the list slides
  // under it.
  pinnedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bgBase,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pinnedInner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: PINNED_GAP,
    paddingBottom: spacing.md,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgBase,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Same height (the pinned bar sits exactly below it), just no line.
  barJoined: {
    borderBottomColor: 'transparent',
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
}));
