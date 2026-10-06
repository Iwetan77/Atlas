import type { ThemeName } from '@/theme';

// iOS paints the status-bar and overscroll areas from the document, outside the app's cards.
export function applyPageTheme(theme: ThemeName, background: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.atlasTheme = theme;
  root.style.setProperty('--atlas-page-bg', background);
  root.style.backgroundColor = background;
  root.style.colorScheme = theme;
  if (document.body) {
    document.body.style.backgroundColor = background;
    document.body.style.backgroundImage = 'none';
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
}

// Before hydration, use the saved choice for the canvas and browser chrome too.
export function pageThemeBootstrap(key: string, backgrounds: Record<ThemeName, string>) {
  return `(function(){
    var theme = 'dark';
    try { if (localStorage.getItem(${JSON.stringify(key)}) === 'light') theme = 'light'; } catch (_) {}
    var background = ${JSON.stringify(backgrounds)}[theme];
    var root = document.documentElement;
    root.dataset.atlasTheme = theme;
    root.style.setProperty('--atlas-page-bg', background);
    root.style.backgroundColor = background;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', background);
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
  })();`;
}
