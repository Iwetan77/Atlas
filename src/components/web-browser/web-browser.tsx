// Plain web browsing inside Atlas: no wallet is connected here (mini apps are the vetted sites that
// get one). Web pages only; anything else (a phone number, an email) goes to the phone.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { addressOrSearch, siteOf } from '@/components/web-browser/address';
import { Icon, type IconName } from '@/components/ui/icon';
import { colors, radii, spacing, type as typeScale, themedStyles } from '@/theme';

export function WebBrowser({ url: start }: { url: string }) {
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const addressInput = useRef<TextInput>(null);
  const [url, setUrl] = useState(start);
  const [current, setCurrent] = useState(start);
  const [typed, setTyped] = useState<string | null>(null);
  const [nav, setNav] = useState({ back: false, forward: false, loading: true });

  const go = () => {
    const next = typed === null ? null : addressOrSearch(typed);
    setTyped(null);
    if (next) setUrl(next);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={24} color="textPrimary" />
        </Pressable>
        <View style={styles.address}>
          <Icon name={/^https:/i.test(current) ? 'lock-closed' : 'globe-outline'} size={14} color="textSecondary" />
          <TextInput
            ref={addressInput}
            value={typed ?? siteOf(current)}
            onFocus={() => setTyped(current)}
            onBlur={() => setTyped(null)}
            onChangeText={setTyped}
            onSubmitEditing={go}
            selectTextOnFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="web-search"
            returnKeyType="go"
            placeholder="Search or type an address"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Address"
            style={styles.input}
            underlineColorAndroid="transparent"
          />
          {typed ? (
            <Pressable onPress={() => { setTyped(''); addressInput.current?.focus(); }}
              accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
              <Icon name="close-circle" size={20} color="textSecondary" />
            </Pressable>
          ) : null}
          {nav.loading ? <ActivityIndicator size="small" color={colors.accentPink} /> : null}
        </View>
        <Tool icon="refresh" label="Reload" onPress={() => web.current?.reload()} />
      </View>
      <WebView
        ref={web}
        source={{ uri: url }}
        style={styles.web}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        onNavigationStateChange={(s) => {
          setCurrent(s.url);
          setNav({ back: s.canGoBack, forward: s.canGoForward, loading: s.loading });
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (/^(https?|about|blob|data):/i.test(request.url)) return true;
          if (/^(mailto|tel|sms):/i.test(request.url)) Linking.openURL(request.url).catch(() => {});
          return false;
        }}
      />
      <View style={[styles.tools, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Tool icon="chevron-back" label="Back" disabled={!nav.back} onPress={() => web.current?.goBack()} />
        <Tool icon="chevron-forward" label="Forward" disabled={!nav.forward} onPress={() => web.current?.goForward()} />
        <Tool icon="open-outline" label="Open in your browser" onPress={() => Linking.openURL(current).catch(() => {})} />
      </View>
    </View>
  );
}

function Tool({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color={disabled ? 'textDisabled' : 'textPrimary'} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  address: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bgSurface,
  },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typeScale.body,
  },
  web: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  tool: {
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
}));
