// On the website the browser reads the photo itself: Tesseract (open source, from jsDelivr), the
// same reader the app runs in a hidden web view. Nothing leaves the phone except the download of
// Tesseract itself.
import { forwardRef, useEffect, useImperativeHandle } from 'react';

// `turn`: degrees to rotate the photo first (a phone can save a portrait shot sideways).
export type TextReader = { read: (jpegBase64: string, turn?: number) => Promise<string> };

type Worker = {
  recognize: (image: string) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
};
type Tesseract = { createWorker: (lang: string) => Promise<Worker> };

const SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const READ_MS = 45_000;

let loading: Promise<Worker> | null = null;

// One reader for the page, made the first time it's needed; a failed download is tried again later.
function reader(): Promise<Worker> {
  if (!loading) {
    loading = new Promise<Tesseract>((resolve, reject) => {
      const ready = (window as { Tesseract?: Tesseract }).Tesseract;
      if (ready) return resolve(ready);
      const script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => {
        const loaded = (window as { Tesseract?: Tesseract }).Tesseract;
        if (loaded) resolve(loaded);
        else reject(new Error('Couldn’t start the reader. Try again.'));
      };
      script.onerror = () => reject(new Error('Couldn’t load the reader. Check your connection and try again.'));
      document.head.appendChild(script);
    })
      .then((t) => t.createWorker('eng'))
      .then(async (worker) => {
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        return worker;
      });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

function rotated(src: string, turn: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sideways = turn % 180 !== 0;
      canvas.width = sideways ? img.height : img.width;
      canvas.height = sideways ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Couldn’t open the photo'));
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Couldn’t open the photo'));
    img.src = src;
  });
}

export const TextReaderView = forwardRef<TextReader>(function TextReaderView(_, ref) {
  // Start the download while the camera opens, so the first Read is quicker.
  useEffect(() => {
    reader().catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({
    read: (image, turn = 0) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Reading the photo took too long')), READ_MS);
        const src = `data:image/jpeg;base64,${image}`;
        Promise.all([reader(), turn ? rotated(src, turn) : src])
          .then(([worker, photo]) => worker.recognize(photo))
          .then((result) => resolve(result.data.text), reject)
          .finally(() => clearTimeout(timer));
      }),
  }));

  return null;
});
