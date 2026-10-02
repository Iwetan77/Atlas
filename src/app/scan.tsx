import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Bank } from '@/api/contract';
import { listBanks } from '@/api/send';
import { useAtlasAuth } from '@/auth/context';
import { Icon } from '@/components/ui/icon';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { readAccountDetails } from '@/scan/account-details';
import { type TextReader, TextReaderView } from '@/scan/text-reader';
import { colors, radii, spacing } from '@/theme';

// Scan to pay: a QR code (an Atlas Link, a web address, bank details), or a photo of an account
// number on a sign or card ("9033935622 Moniepoint Ivan Wetan"), which fills Send to bank. The
// bank confirms the holder's name before any money moves.
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAtlasAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const reader = useRef<TextReader>(null);
  const handled = useRef(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    listBanks(getAccessToken).then(setBanks, () => {});
  }, [getAccessToken]);

  // What scanned text leads to; false when it's none of these.
  const act = (raw: string): boolean => {
    const text = raw.trim();
    const claim = text.match(/\/claim\/(0x[0-9a-fA-F]{40})(?:#k=(0x[0-9a-fA-F]{64}))?/);
    if (claim) {
      router.replace({ pathname: '/claim/[linkId]', params: { linkId: claim[1], ...(claim[2] ? { k: claim[2] } : {}) } });
      return true;
    }
    if (/^https?:\/\/\S+$/i.test(text)) {
      router.replace({ pathname: '/browse', params: { url: text } });
      return true;
    }
    const account = readAccountDetails(text, banks);
    if (account) {
      router.replace({
        pathname: '/send/bank',
        params: { account: account.accountNumber, ...(account.bankCode ? { bank: account.bankCode } : {}) },
      });
      return true;
    }
    return false;
  };

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return;
    if (act(data)) handled.current = true;
    else setNote(`This code says “${data.slice(0, 80)}”. It isn’t an account number or an Atlas link.`);
  };

  const readPhoto = async () => {
    setReading(true);
    setNote(null);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (!shot || !reader.current) throw new Error('Reading photos works in the Atlas app.');
      // Smaller is faster to read, and still sharp enough for printed digits.
      const image = await ImageManipulator.manipulate(shot.uri).resize({ width: 1400 }).renderAsync();
      const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      const text = await reader.current.read(saved.base64 ?? '');
      if (!act(text)) setNote('Couldn’t find an account number. Move closer and keep it steady, or type it in.');
      else handled.current = true;
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Couldn’t read the photo. Try again.');
    } finally {
      setReading(false);
    }
  };

  if (!permission) return <Screen />;
  if (!permission.granted) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={24} color="textPrimary" />
        </Pressable>
        <Text variant="title">Scan to pay</Text>
        <Text color="textSecondary">
          Atlas uses the camera to read QR codes and account numbers, so you don’t have to type them.
        </Text>
        <PillButton label="Allow camera" onPress={requestPermission} />
        <PillButton label="Type an account number" tone="secondary" onPress={() => router.replace('/send/bank')} />
      </Screen>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={reading ? undefined : onScanned}
      />
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={26} color="textPrimary" />
        </Pressable>
        <Text variant="heading">Scan to pay</Text>
        <Pressable
          onPress={() => router.replace('/deposit')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Show my code">
          <Icon name="qr-code-outline" size={24} color="textPrimary" />
        </Pressable>
      </View>
      <View style={styles.frame} pointerEvents="none" />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text color="textSecondary" style={styles.center}>
          {note ?? 'Point at a QR code, or at an account number on a sign or card and tap Read.'}
        </Text>
        <PillButton label={reading ? 'Reading…' : 'Read account number'} icon="scan-outline" loading={reading} onPress={readPhoto} />
        <PillButton label="Type it instead" tone="secondary" onPress={() => router.replace('/send/bank')} />
      </View>
      <TextReaderView ref={reader} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.scrim,
  },
  frame: {
    alignSelf: 'center',
    marginTop: '20%',
    width: 260,
    height: 260,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.accentPink,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  center: {
    textAlign: 'center',
  },
});
