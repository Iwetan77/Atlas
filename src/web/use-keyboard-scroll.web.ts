import { useEffect } from 'react';

type Axis = 'x' | 'y';
const CONTROLS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"], [role="tablist"], [role="tree"], [role="grid"], [role="radiogroup"]';

function visible(element: HTMLElement) {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
    rect.top < window.innerHeight && rect.left < window.innerWidth &&
    getComputedStyle(element).visibility !== 'hidden';
}

function scrolls(element: HTMLElement, axis: Axis) {
  const style = getComputedStyle(element);
  return visible(element) && /^(auto|scroll|overlay)$/.test(axis === 'y' ? style.overflowY : style.overflowX) &&
    (axis === 'y' ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth) > 1;
}

function scope() {
  // Modal portals sit outside the page: their keys must never move the page underneath.
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], [role="dialog"]')).filter(visible);
  return dialogs.at(-1) ?? document.getElementById('atlas-main') ?? document.body;
}

function ancestors(start: HTMLElement | null, root: HTMLElement, axis: Axis) {
  const found: HTMLElement[] = [];
  if (!start || !root.contains(start)) return found;
  for (let node: HTMLElement | null = start; node; node = node.parentElement) {
    if (scrolls(node, axis)) found.push(node);
    if (node === root) break;
  }
  return found;
}

function pageScroller(root: HTMLElement, axis: Axis) {
  // Hidden tab screens and horizontal carousels are excluded from the page's vertical scroll.
  const candidates = [root, ...root.querySelectorAll<HTMLElement>('*')].filter((node) => scrolls(node, axis));
  return candidates.sort((a, b) => {
    const area = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) *
        Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    };
    return area(b) - area(a);
  })[0];
}

export function useKeyboardScroll() {
  useEffect(() => {
    let pointed: HTMLElement | null = null;
    const remember = (event: Event) => { pointed = event.target instanceof HTMLElement ? event.target : null; };
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const axis: Axis | null = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'y' :
        event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'x' : null;
      if (!axis) return;
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const target = event.target instanceof HTMLElement ? event.target : focused;
      if (target?.closest(CONTROLS)) return;
      const root = scope();
      const options = ancestors(focused, root, axis);
      if (!options.length) options.push(...ancestors(pointed, root, axis));
      if (!options.length) {
        // Left/right only affect a focused or clicked scroller, never an unrelated carousel.
        if (axis === 'x') return;
        const page = pageScroller(root, axis);
        if (page) options.push(page);
      }
      const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -56 : 56;
      for (const element of options) {
        const before = axis === 'y' ? element.scrollTop : element.scrollLeft;
        const max = axis === 'y' ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth;
        if (step < 0 ? before <= 0 : before >= max - 1) continue;
        element.scrollBy({ top: axis === 'y' ? step : 0, left: axis === 'x' ? step : 0, behavior: 'instant' });
        event.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', remember, { passive: true });
    document.addEventListener('wheel', remember, { passive: true });
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('pointerdown', remember);
      document.removeEventListener('wheel', remember);
    };
  }, []);
}
