import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import type { ShareImageOptions } from '@/components/share/share-image-sheet';

export function useShareImage(card: RefObject<View | null>, aspect: number, fileName: string, dialogTitle: string) {
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const savingNow = useRef(false);
  const image = useRef<string | null>(null);
  const run = useRef(0);
  useEffect(() => () => { run.current++; if (image.current) releaseCapture(image.current); }, []);

  const close = () => {
    run.current++; setVisible(false); setSharing(false); setPreview(null);
    if (image.current) releaseCapture(image.current); image.current = null;
  };
  const share = async () => {
    const mine = ++run.current;
    setVisible(true); setSharing(true); setShareError(null); setPreview(null); setNotice(null);
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
    if (!uri || savingNow.current) return;
    savingNow.current = true; setSaving(true); setShareError(null); setNotice(null);
    const mine = run.current;
    let copy: string | undefined;
    try {
      if (Platform.OS === 'android') {
        // Scoped storage can add our own PNG on Android 11+ without reading anyone's photos.
        if (Number(Platform.Version) < 30) {
          const permission = await requestPermissionsAsync(true, []);
          if (!permission.granted) {
            if (run.current === mine) setShareError('Allow Atlas to save images, then try again.');
            return;
          }
        }
        if (!FileSystem.cacheDirectory) throw new Error('cache unavailable');
        copy = `${FileSystem.cacheDirectory}${fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        await FileSystem.copyAsync({ from: uri.startsWith('/') ? `file://${uri}` : uri, to: copy });
        await Asset.create(copy);
        if (run.current === mine) setNotice('Image saved to Pictures.');
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save image' });
      }
    } catch { if (run.current === mine) setShareError("Couldn't save the image. Try again."); }
    finally {
      if (copy) await FileSystem.deleteAsync(copy, { idempotent: true }).catch(() => {});
      savingNow.current = false;
      setSaving(false);
    }
  };
  const menu: ShareImageOptions = { visible, preparing: sharing, ready: !!preview, preview, error: shareError, saving, notice, canShare: true,
    onClose: close, onRetry: share, onShare: shareToApps, onDownload: download };
  return { share, sharing, shareError, menu };
}
