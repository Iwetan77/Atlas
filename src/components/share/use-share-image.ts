import * as Sharing from 'expo-sharing';
import { type RefObject, useState } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// Shared image width in pixels: sharp enough to post.
const EXPORT_W = 1080;

// Turns a card view into a PNG and opens the share sheet (downloads it on the web).
export function useShareImage(card: RefObject<View | null>, aspect: number, fileName: string, dialogTitle: string) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const share = async () => {
    setSharing(true);
    setShareError(null);
    const size = { width: EXPORT_W, height: EXPORT_W / aspect };
    try {
      if (Platform.OS === 'web') {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'data-uri', ...size });
        const a = document.createElement('a');
        a.href = uri;
        a.download = fileName;
        a.click();
      } else {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', ...size });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
      }
    } catch (e) {
      console.warn('[atlas] share card failed', e);
      setShareError("Couldn't create the image. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return { share, sharing, shareError };
}
