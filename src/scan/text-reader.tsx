// Reads printed text in a photo, on the phone: Tesseract (open source, from jsDelivr) running in a
// hidden web view, since Expo Go has no text recognition of its own. Nothing leaves the phone except
// the download of Tesseract itself.
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export type TextReader = { read: (jpegBase64: string) => Promise<string> };

const PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script></head><body><script>
let worker;
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
async function ready(){
  if(!worker){worker=await Tesseract.createWorker('eng');await worker.setParameters({tessedit_pageseg_mode:'11'});}
  return worker;
}
async function onMessage(e){
  let msg;try{msg=JSON.parse(e.data);}catch(_){return;}
  try{const w=await ready();const r=await w.recognize('data:image/jpeg;base64,'+msg.image);post({id:msg.id,text:r.data.text});}
  catch(err){post({id:msg.id,error:String((err&&err.message)||err)});}
}
window.addEventListener('message',onMessage);document.addEventListener('message',onMessage);
ready().catch(function(){});
</script></body></html>`;

export const TextReaderView = forwardRef<TextReader>(function TextReaderView(_, ref) {
  const web = useRef<WebView>(null);
  const waiting = useRef(new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void }>());
  const next = useRef(1);

  useImperativeHandle(ref, () => ({
    read: (image) =>
      new Promise<string>((resolve, reject) => {
        const id = next.current++;
        waiting.current.set(id, { resolve, reject });
        web.current?.postMessage(JSON.stringify({ id, image }));
        setTimeout(() => {
          if (waiting.current.delete(id)) reject(new Error('Reading the photo took too long'));
        }, 45_000);
      }),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: { id?: number; text?: string; error?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    const pending = msg.id === undefined ? undefined : waiting.current.get(msg.id);
    if (!pending || msg.id === undefined) return;
    waiting.current.delete(msg.id);
    if (typeof msg.text === 'string') pending.resolve(msg.text);
    else pending.reject(new Error(msg.error ?? 'Couldn’t read the photo'));
  };

  return (
    <WebView
      ref={web}
      source={{ html: PAGE, baseUrl: 'https://localhost/' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      style={styles.hidden}
      pointerEvents="none"
    />
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
