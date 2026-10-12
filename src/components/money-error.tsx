import { StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { useAddMoney } from '@/funding/add-money';
import { openMove } from '@/funding/move-money';
import { spacing } from '@/theme';

// An engine message shown under a form, with the button that fixes it:
// - a trade short in the trading balance → Add money, from Spendable into Trading (filled in with
//   `shortfall` when the screen knows it);
// - a send short in Spendable while Trading holds money → Move from trading;
// - otherwise "Add money" → the Add money sheet.
export function MoneyError({ message, shortfall }: { message: string; shortfall?: number }) {
  const addMoney = useAddMoney();
  const fromTrading = /move it to spendable/i.test(message);
  const toTrading = !fromTrading && /trading balance/i.test(message) && /add money/i.test(message);
  const short = !fromTrading && !toTrading && /add money/i.test(message);
  return (
    <View style={styles.wrap}>
      <Text color="danger">{message}</Text>
      {toTrading ? <PillButton label="Add money" icon="add" size="sm" onPress={() => openMove('to_trading', shortfall)} /> : null}
      {fromTrading ? <PillButton label="Move from trading" icon="swap-horizontal" size="sm" onPress={() => openMove('to_spendable', shortfall)} /> : null}
      {short ? <PillButton label="Add money" icon="add" size="sm" onPress={addMoney} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
});
