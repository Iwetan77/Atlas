import { View } from 'react-native';

import { useTransactions } from '@/api/transactions';
import { TransactionList } from '@/components/transactions/transaction-list';
import { BackHeader } from '@/components/ui/back-header';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useSettings } from '@/settings/context';
import { spacing } from '@/theme';

export default function TransactionsScreen() {
  const { data, error, reload, loadMore, hasMore, loadingMore } = useTransactions(20);
  const { stealthMode } = useSettings();
  return <Screen>
    <BackHeader title="Transactions" />
    <Text variant="caption" color="textSecondary">Your activity, from confirmation to completion.</Text>
    {error ? <View style={{ gap: spacing.sm }}><Text variant="caption" color="danger">{error}</Text><PillButton label="Refresh" tone="secondary" size="sm" onPress={() => void reload()} /></View> : null}
    {data?.length ? <TransactionList rows={data} stealth={stealthMode} /> : <Text color="textSecondary">{data ? 'No transactions yet.' : 'Loading your activity…'}</Text>}
    {hasMore ? <PillButton label={loadingMore ? 'Loading…' : 'See older transactions'} tone="secondary" disabled={loadingMore} onPress={() => void loadMore()} /> : null}
  </Screen>;
}
