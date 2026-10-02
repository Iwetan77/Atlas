import { useLocalSearchParams } from 'expo-router';

import { WebBrowser } from '@/components/web-browser/web-browser';

// /browse?url=…: a web page or search, from the More tab's search bar.
export default function BrowseScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  return <WebBrowser url={url && /^https?:\/\//i.test(url) ? url : 'https://duckduckgo.com'} />;
}
