// On the website the browser reads the photo itself: Tesseract (open source, from jsDelivr), the
// same reader the app runs in a hidden web view. Nothing leaves the phone except the download of
// Tesseract itself.
import { forwardRef, useEffect, useImperativeHandle } from 'react';

export type TextReader = { read: (jpegBase64: string) => Promise<string> };

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

export const TextReaderView = forwardRef<TextReader>(function TextReaderView(_, ref) {
  // Start the download while the camera opens, so the first Read is quicker.
  useEffect(() => {
    reader().catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({
    read: (image) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Reading the photo took too long')), READ_MS);
        reader()
          .then((worker) => worker.recognize(`data:image/jpeg;base64,${image}`))
          .then((result) => resolve(result.data.text), reject)
          .finally(() => clearTimeout(timer));
      }),
  }));

  return null;
});
