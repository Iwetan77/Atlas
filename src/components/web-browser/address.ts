// What the More tab's search bar opens: an address as typed ("jup.ag", "https://…"), or a
// DuckDuckGo search (free, no key, no tracking) for anything else.
export function addressOrSearch(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^https?:\/\/\S+$/i.test(text)) return text;
  if (/^[^\s/]+\.[a-z]{2,}(?::\d+)?(\/\S*)?$/i.test(text)) return `https://${text}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
}

// The site's name for the address bar: "jup.ag" for "https://jup.ag/swap".
export function siteOf(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] ?? url;
}
