import { StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { useAddMoney } from '@/funding/add-money';
import { openMove } from '@/funding/move-money';
import { useSettings } from '@/settings/context';
import { spacing } from '@/theme';

// Amounts the engine wrote into a message ("₦12,400.00", "$3.50", "KSh 1,000"), for stealth mode.
const AMOUNTS = /(₦|\$|€|£|KSh ?|GH₵|R)\d[\d,]*(?:\.\d+)?/g;

// An engine message shown under a form, with the button that fixes it:
// - a trade short in the trading balance → Add money, from Spendable into Trading (filled in with
//   `shortfall` when the screen knows it);
// - a send short in Spendable while Trading holds money → Move from trading;
// - otherwise "Add money" → the Add money sheet.
export function MoneyError({ message, shortfall }: { message: string; shortfall?: number }) {
  const addMoney = useAddMoney();
  const { stealthMode } = useSettings();
  // The words pick the button; with stealth on, the amounts in them stay hidden like everywhere else.
  const shown = stealthMode ? message.replace(AMOUNTS, '$1••••') : message;
  const fromTrading = /move it to spendable/i.test(message);
  const toTrading = !fromTrading && /trading balance/i.test(message) && /add money/i.test(message);
  const short = !fromTrading && !toTrading && /add money/i.test(message);
  return (
    <View style={styles.wrap}>
      <Text color="danger">{shown}</Text>
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
