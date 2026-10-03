import { StyleSheet, View } from 'react-native';

import { useBalance } from '@/api/balance';
import type { BalanceResponse } from '@/api/contract';
import { Text } from '@/components/ui/text';
import { formatMoney, hiddenMoney } from '@/format/money';
import { useSettings } from '@/settings/context';
import { colors, radii, spacing } from '@/theme';

// Cash that can leave right now: USDC in the Base and Solana wallets. Coins, savings, perps margin
// and Arc cash count in the balance but have to be sold or moved back first.
export function spendableAmount(balance: BalanceResponse): number {
  return balance.holdings
    .filter((h) => h.kind === 'cash' && (h.location ?? 'wallet') === 'wallet' && (h.chain === 'base' || h.chain === 'solana'))
    .reduce((sum, h) => sum + Number(h.value.amount), 0);
}

// On Send and Withdraw: what can be sent, next to the whole balance.
export function SpendableCard() {
  const { data } = useBalance();
  const { stealthMode } = useSettings();
  if (!data) return null;
  const currency = data.total.currency;
  const spendable = spendableAmount(data);
  const total = Number(data.total.amount);
  const show = (amount: number) => (stealthMode ? hiddenMoney(currency) : formatMoney({ amount: amount.toFixed(2), currency }));
  const locked = total - spendable > 0.01;
  return (
    <View style={styles.card} accessibilityLabel={`Spendable now ${show(spendable)}`}>
      <Text variant="label" style={styles.label}>
        Spendable now
      </Text>
      <Text variant="title" style={styles.amount}>
        {show(spendable)}
      </Text>
      {locked ? (
        <Text variant="caption" style={styles.note}>
          Of {show(total)} in total. The rest is in your coins, savings or perps: sell or withdraw them to spend it.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xxs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.accentPink,
  },
  label: {
    color: colors.textOnAccent,
    opacity: 0.85,
  },
  amount: {
    color: colors.textOnAccent,
  },
  note: {
    color: colors.textOnAccent,
    opacity: 0.85,
  },
});
