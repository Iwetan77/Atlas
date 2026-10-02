// On the web there's no camera scan screen to read photos from.
import { forwardRef } from 'react';

export type TextReader = { read: (jpegBase64: string) => Promise<string> };

export const TextReaderView = forwardRef<TextReader>(function TextReaderView() {
  return null;
});
