import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bank } from '@/api/contract';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, maxContentWidth, radii, spacing } from '@/theme';

// Tappable field that opens a searchable list of banks.
export function BankPicker({
  banks,
  value,
  onChange,
  error,
}: {
  banks: Bank[] | null;
  value: Bank | null;
  onChange: (bank: Bank) => void;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const shown = useMemo(
    () => (banks ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [banks, query],
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!banks}
        accessibilityRole="button"
        accessibilityLabel={value ? `Bank: ${value.name}` : 'Choose bank'}
        style={styles.trigger}>
        <Icon name="business-outline" size={20} color="textSecondary" />
        <Text variant="heading" color={value ? 'textPrimary' : 'textDisabled'} style={styles.triggerText}>
          {value?.name ?? (banks ? 'Choose bank' : error ? 'Banks unavailable' : 'Loading banks…')}
        </Text>
        <Icon name="chevron-down" size={18} color="textSecondary" />
      </Pressable>
      {error && !banks ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHeader}>
              <Text variant="title">Choose bank</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close">
                <Icon name="close" size={24} color="textPrimary" />
              </Pressable>
            </View>
            <Field
              prefix={<Icon name="search" size={20} color="textSecondary" />}
              placeholder="Search banks"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <FlatList
              data={shown}
              keyExtractor={(b) => b.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={({ pressed }) => [styles.bank, pressed && { backgroundColor: colors.bgSurfaceAlt }]}>
                  <Text variant="bodyStrong">{item.name}</Text>
                  {value?.code === item.code ? <Icon name="checkmark" size={18} color="accentPink" /> : null}
                </Pressable>
              )}
              ListEmptyComponent={<Text color="textSecondary">No bank matches “{query}”.</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.bgSurface,
  },
  triggerText: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    height: '80%',
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.bgBase,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bank: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
});
