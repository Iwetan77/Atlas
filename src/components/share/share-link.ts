import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

// Always carry the working URL, including a cashlink's private fragment, in copy fallbacks.
export async function shareLink(caption: string, url: string, title = 'Atlas'): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, text: caption, url }); return 'shared'; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled'; }
    }
    await Clipboard.setStringAsync(`${caption}\n${url}`);
    return 'copied';
  }
  const result = await Share.share({ title, message: `${caption}\n${url}` });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
