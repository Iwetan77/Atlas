// On the web, a page opens in its own tab.
import { router } from 'expo-router';
import { useEffect } from 'react';

export function WebBrowser({ url }: { url: string }) {
  useEffect(() => {
    window.open(url, '_blank', 'noopener');
    router.back();
  }, [url]);
  return null;
}
