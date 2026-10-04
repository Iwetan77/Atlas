import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import type { ShareImageOptions } from '@/components/share/share-image-sheet';

export function useShareImage(card: RefObject<View | null>, aspect: number, fileName: string, dialogTitle: string) {
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const image = useRef<string | null>(null);
  const run = useRef(0);
  useEffect(() => () => { run.current++; if (image.current) releaseCapture(image.current); }, []);

  const close = () => {
    run.current++; setVisible(false); setSharing(false); setPreview(null);
    if (image.current) releaseCapture(image.current); image.current = null;
  };
  const share = async () => {
    const mine = ++run.current;
    setVisible(true); setSharing(true); setShareError(null); setPreview(null);
    if (image.current) releaseCapture(image.current); image.current = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const uri = await Promise.race([
        captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: Math.round(1080 / aspect) }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('capture timeout')), 20_000); }),
      ]);
      if (run.current !== mine) { releaseCapture(uri); return; }
      image.current = uri; setPreview(uri);
    } catch { if (run.current === mine) setShareError("Couldn't create the image. Try again."); }
    finally { if (timer) clearTimeout(timer); if (run.current === mine) setSharing(false); }
  };
  const shareToApps = async () => {
    const uri = image.current;
    if (!uri) return;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('unavailable');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
    } catch { setShareError("Sharing isn't available. Try Download image instead."); }
  };
  const download = async () => {
    const uri = image.current;
    if (!uri) return;
    try {
      if (Platform.OS === 'android') {
        const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!access.granted) return;
        const contents = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const file = await FileSystem.StorageAccessFramework.createFileAsync(access.directoryUri, fileName, 'image/png');
        await FileSystem.writeAsStringAsync(file, contents, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        // iOS offers Save Image in its own share sheet.
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save image' });
      }
    } catch { setShareError("Couldn't save the image. Try again."); }
  };
  const menu: ShareImageOptions = { visible, preparing: sharing, ready: !!preview, preview, error: shareError, canShare: true,
    onClose: close, onRetry: share, onShare: shareToApps, onDownload: download };
  return { share, sharing, shareError, menu };
}
