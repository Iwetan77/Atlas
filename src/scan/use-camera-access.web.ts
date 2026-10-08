import { useEffect, useState } from 'react';

import { readDeviceValue, writeDeviceValue } from '@/auth/device-session';

const USED = 'atlas.camera.used';
// Remember that camera setup was completed, not an OS permission. CameraView still asks the browser
// for a real stream, and the browser can refuse. Avoid opening and stopping a second stream just to
// ask permission before CameraView opens the actual scanner.
export function useCameraAccess() {
  const [start, setStart] = useState(() => readDeviceValue(USED) === '1');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => navigator.permissions?.query({ name: 'camera' as PermissionName })).then((permission) => {
      if (!live || !permission) return;
      if (permission.state === 'granted') setStart(true);
      else if (permission.state === 'denied') {
        setStart(false);
        writeDeviceValue(USED, null);
        setError('Camera access is off. Allow the camera for Atlas in your browser’s website settings, then try again.');
      }
    }).catch(() => {}); // Safari can use a camera without supporting this permission query.
    return () => { live = false; };
  }, []);
  return {
    loading: false, start, canAskAgain: true, error,
    request: () => { setError(null); setStart(true); },
    onReady: () => { writeDeviceValue(USED, '1'); setError(null); },
    onError: (_error: { message: string }) => {
      writeDeviceValue(USED, null);
      setStart(false);
      setError('The camera could not open. Check camera access in your browser’s website settings, or type the account number.');
    },
  };
}
