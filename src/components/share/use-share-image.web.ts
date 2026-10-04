import html2canvas from 'html2canvas';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { ShareImageOptions } from '@/components/share/share-image-sheet';

const WAIT_MS = 20_000;

// Capture only the card. Cloning the whole dashboard makes Safari wait on unrelated images.
export async function captureCard(node: HTMLElement, aspect: number): Promise<Blob> {
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) throw new Error('Card is not visible');
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.dataset.atlasCardCapture = 'true';
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: rect.width + 'px',
    height: rect.height + 'px', border: '0', pointerEvents: 'none' });
  document.body.appendChild(frame);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Capture could not start');
    doc.open(); doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"></body></html>'); doc.close();
    const clone = node.cloneNode(true) as HTMLElement;
    const from = [node, ...node.querySelectorAll('*')];
    const to = [clone, ...clone.querySelectorAll('*')];
    from.forEach((source, i) => {
      const target = to[i] as HTMLElement | SVGElement;
      const computed = getComputedStyle(source);
      for (const key of Array.from(computed)) target.style.setProperty(key, computed.getPropertyValue(key));
      if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
        target.loading = 'eager'; target.crossOrigin = 'anonymous'; target.src = source.currentSrc || source.src;
        target.removeAttribute('srcset');
      }
    });
    Object.assign(clone.style, { position: 'relative', left: '0', top: '0', margin: '0',
      width: rect.width + 'px', height: rect.height + 'px', transform: 'none' });
    const fonts = doc.createElement('style');
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) if (rule.type === CSSRule.FONT_FACE_RULE) fonts.textContent += rule.cssText;
      } catch { /* External CSS is not needed; the card's computed styles are already copied. */ }
    }
    doc.head.appendChild(fonts); doc.body.appendChild(clone);
    const render = async () => {
      const canvas = await html2canvas(clone, { backgroundColor: null, useCORS: true, allowTaint: false,
        logging: false, imageTimeout: 4_000, scale: 1080 / rect.width,
        width: rect.width, height: rect.width / aspect, windowWidth: Math.ceil(rect.width), windowHeight: Math.ceil(rect.height) });
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error('Image could not be created')), 'image/png'));
    };
    return await Promise.race([render(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('capture timeout')), WAIT_MS);
    })]);
  } finally { if (timer) clearTimeout(timer); frame.remove(); }
}

export function useShareImage(card: RefObject<View | null>, aspect: number, fileName: string, dialogTitle: string) {
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const image = useRef<{ file: File; url: string } | null>(null);
  const run = useRef(0);
  const clear = () => { if (image.current) URL.revokeObjectURL(image.current.url); image.current = null; };
  useEffect(() => () => { run.current++; if (image.current) URL.revokeObjectURL(image.current.url); }, []);
  const close = () => { run.current++; setVisible(false); setSharing(false); setPreview(null); clear(); };
  const share = async () => {
    const mine = ++run.current;
    setVisible(true); setSharing(true); setShareError(null); setPreview(null); setCanShare(false); clear();
    try {
      const node = card.current as unknown as HTMLElement | null;
      if (!node) throw new Error('Card is not ready');
      const blob = await captureCard(node, aspect);
      if (run.current !== mine) return;
      const file = new File([blob], fileName, { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      image.current = { file, url }; setPreview(url);
      setCanShare(typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
    } catch { if (run.current === mine) setShareError("Couldn't create the image. Try again."); }
    finally { if (run.current === mine) setSharing(false); }
  };
  const shareToApps = () => {
    const ready = image.current;
    if (!ready || !navigator.share) return;
    // No await before this call: the tap's user activation must reach Safari's share API.
    void navigator.share({ files: [ready.file], title: dialogTitle }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareError("Sharing didn't open. Use Download image instead.");
    });
  };
  const download = () => {
    const ready = image.current;
    if (!ready) return;
    const link = document.createElement('a'); link.href = ready.url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
  };
  const menu: ShareImageOptions = { visible, preparing: sharing, ready: !!preview, preview, error: shareError, canShare,
    onClose: close, onRetry: share, onShare: shareToApps, onDownload: download };
  return { share, sharing, shareError, menu };
}
