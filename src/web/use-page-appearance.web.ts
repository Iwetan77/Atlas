import { useEffect } from 'react';

import { applyPageTheme } from '@/web/page-appearance';
import { colors, type ThemeName } from '@/theme';

export function usePageAppearance(theme: ThemeName) {
  useEffect(() => {
    applyPageTheme(theme, colors.bgBase);
    const standalone = !!(navigator as Navigator & { standalone?: boolean }).standalone
      || window.matchMedia('(display-mode: standalone)').matches;
    const iphone = /iPhone|iPod/.test(navigator.userAgent);
    if (!standalone || !iphone) return;

    // While someone is typing, the keyboard and its suggestion bar resize the visible viewport on
    // every key. Resizing the page under a focused field makes WebKit drop the focus, which closes
    // the keyboard after each digit, so the page is only refit while nothing is being typed in.
    const typing = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement && !!active.closest('input, textarea, [contenteditable="true"]');
    };
    // Drawn under a translucent status bar (the status-bar backdrop has the top inset's height),
    // WebKit leaves the status bar's height out of innerHeight: fitting that left a strip of page
    // under the tabs. There the app takes the screen's full height. Under an opaque status bar
    // (light mode) the top inset is 0 and innerHeight is the whole viewport, so the tabs never move
    // below the screen.
    const underStatusBar = () =>
      (document.getElementById('atlas-statusbar-backdrop')?.getBoundingClientRect().height ?? 0) > 0;
    const fit = () => {
      if (typing()) return;
      const portrait = window.innerWidth < window.innerHeight;
      const short = underStatusBar() && portrait && window.innerHeight < window.screen.height;
      const height = `${short ? window.screen.height : window.innerHeight}px`;
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
        if (el) el.style.height = height;
      }
    };
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('pageshow', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    // Typing finished: fit the page the keyboard left behind.
    const done = () => requestAnimationFrame(fit);
    document.addEventListener('focusout', done);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pageshow', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      document.removeEventListener('focusout', done);
    };
  }, [theme]);
}
