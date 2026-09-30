import { StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Text } from '@/components/ui/text';
import { useAddMoney } from '@/funding/add-money';
import { spacing } from '@/theme';

// An engine message shown under a form. "Not enough in your balance… Add money" gets the button
// that does it.
export function MoneyError({ message }: { message: string }) {
  const addMoney = useAddMoney();
  const short = /add money/i.test(message);
  return (
    <View style={styles.wrap}>
      <Text color="danger">{message}</Text>
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
