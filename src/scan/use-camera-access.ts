import { useCameraPermissions } from 'expo-camera';

// Native permissions are persisted and enforced by the operating system.
export function useCameraAccess() {
  const [permission, request] = useCameraPermissions();
  return {
    loading: !permission, start: !!permission?.granted, canAskAgain: !!permission?.canAskAgain,
    error: null as string | null, request, onReady: () => {}, onError: (_error: { message: string }) => {},
  };
}
