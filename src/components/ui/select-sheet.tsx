import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, type ColorToken, maxContentWidth, radii, spacing } from '@/theme';

export type SelectItem<K extends string> = {
  key: K;
  label: string;
  // Second line under the label.
  detail?: string;
  // Shown before the label: a flag (text) or a logo.
  leading?: string;
  leadingNode?: ReactNode;
  // Shown at the end of the row, e.g. a rate.
  trailing?: string;
  trailingColor?: ColorToken;
};

// A dropdown that suits a phone: one field showing the current choice; tapping it opens a sheet of
// choices from the bottom.
export function SelectSheet<K extends string>({
  title,
  items,
  value,
  onChange,
  compact,
}: {
  title: string;
  items: SelectItem<K>[];
  value: K;
  onChange: (key: K) => void;
  // A small pill (flag + label) instead of a full-width field, e.g. in a sheet's header.
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.key === value) ?? items[0];
  if (!current) return null;
  // One choice isn't a choice: show it, without the dropdown.
  if (items.length === 1) {
    return (
      <View style={styles.field}>
        <Row item={current} />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current.label}`}
        style={({ pressed }) => [compact ? styles.pill : styles.field, pressed && styles.pressed]}>
        {compact ? (
          <>
            {current.leading ? <Text style={styles.pillLeading}>{current.leading}</Text> : null}
            <Text variant="label">{current.label}</Text>
          </>
        ) : (
          <Row item={current} />
        )}
        <Icon name="chevron-down" size={compact ? 14 : 18} color="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          {/* Taps inside the sheet stay in the sheet. */}
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text variant="heading">{title}</Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {items.map((item) => {
                const selected = item.key === value;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      onChange(item.key);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
                    <Row item={item} />
                    {selected ? <Icon name="checkmark" size={20} color="accentPink" /> : <View style={styles.checkSpace} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row<K extends string>({ item }: { item: SelectItem<K> }) {
  return (
    <View style={styles.row}>
      {item.leadingNode ?? (item.leading ? <Text style={styles.leading}>{item.leading}</Text> : null)}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.label}
        </Text>
        {item.detail ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {item.detail}
          </Text>
        ) : null}
      </View>
      {item.trailing ? (
        <Text variant="bodyStrong" color={item.trailingColor ?? 'textPrimary'}>
          {item.trailing}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillLeading: {
    fontSize: 16,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    maxHeight: '75%',
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
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  optionSelected: {
    backgroundColor: colors.bgSurfaceAlt,
  },
  checkSpace: {
    width: 20,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  leading: {
    fontSize: 24,
    lineHeight: 30,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
});
