import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetAvatar } from '@/components/trade/asset-avatar';
import { Icon, type IconName } from '@/components/ui/icon';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { CURRENCIES } from '@/format/currencies';
import { useSettings } from '@/settings/context';
import { colors, maxContentWidth, radii, spacing } from '@/theme';

const AddMoneyContext = createContext<(() => void) | null>(null);

// Opens the Add money sheet from anywhere: Home's Deposit, or an "Add money" button under a
// "Not enough in your balance" message.
export function useAddMoney() {
  const open = useContext(AddMoneyContext);
  if (!open) throw new Error('useAddMoney must be used inside <AddMoneyProvider>');
  return open;
}

export function AddMoneyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <AddMoneyContext.Provider value={show}>
      {children}
      <AddMoneySheet visible={open} onClose={() => setOpen(false)} />
    </AddMoneyContext.Provider>
  );
}

type Method = {
  key: string;
  title: string;
  subtitle: string;
  icon?: IconName;
  logos?: { symbol: string; url: string | null }[];
  soon?: boolean;
  onPress?: () => void;
};

// Every way money comes in, one tap each. Whatever the route, it lands as one balance.
function AddMoneySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { displayCurrency, update } = useSettings();

  const methods: Method[] = useMemo(
    () => [
      {
        key: 'bank',
        title: 'Bank transfer',
        subtitle: displayCurrency === 'NGN' ? 'Pay in from any Nigerian bank' : 'From your bank account',
        icon: 'business-outline',
        soon: true,
      },
      {
        key: 'wallet',
        title: 'Wallet or exchange',
        subtitle: 'USDT or USDC from Binance, Bybit, OKX or any wallet',
        logos: [
          { symbol: 'USDC', url: null },
          {
            symbol: 'BNB',
            url: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
          },
        ],
        onPress: () => {
          onClose();
          router.push('/deposit');
        },
      },
      {
        key: 'virtual',
        title: 'Virtual bank account',
        subtitle: 'US or EU account details in your name',
        icon: 'globe-outline',
        soon: true,
      },
    ],
    [displayCurrency, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text variant="title">Add money</Text>
            <View style={styles.currency}>
              <SelectSheet
                title="Currency"
                compact
                value={displayCurrency}
                onChange={(code) => update({ displayCurrency: code })}
                items={CURRENCIES.map((c) => ({
                  key: c.code,
                  label: c.code,
                  detail: c.label,
                  leading: c.flag,
                }))}
              />
            </View>
          </View>
          {methods.map((m) => (
            <Pressable
              key={m.key}
              disabled={m.soon}
              onPress={m.onPress}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!m.soon }}
              style={({ pressed }) => [styles.method, pressed && styles.pressed]}>
              <View style={styles.iconWrap}>
                {m.logos ? (
                  <View style={styles.logos}>
                    {m.logos.map((l, i) => (
                      <View key={l.symbol} style={[styles.logo, i > 0 && styles.logoBack]}>
                        <AssetAvatar symbol={l.symbol} iconUrl={l.url} size={24} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Icon name={m.icon ?? 'cash-outline'} size={24} color="textPrimary" />
                )}
              </View>
              <View style={styles.methodText}>
                <Text variant="bodyStrong" color={m.soon ? 'textSecondary' : 'textPrimary'}>
                  {m.title}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {m.subtitle}
                </Text>
              </View>
              {m.soon ? (
                <View style={styles.soon}>
                  <Text variant="caption" color="accentPinkTint">
                    Soon
                  </Text>
                </View>
              ) : (
                <Icon name="chevron-forward" size={18} color="textSecondary" />
              )}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.bgSurface,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  currency: {
    minWidth: 110,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSurfaceAlt,
  },
  pressed: {
    opacity: 0.8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
  },
  logos: {
    flexDirection: 'row',
  },
  logo: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  logoBack: {
    marginLeft: -9,
  },
  methodText: {
    flex: 1,
    gap: spacing.xxs,
  },
  soon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPinkDim,
  },
});
