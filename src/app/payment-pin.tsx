import { router } from 'expo-router';
import { PinSetup } from '@/security/pin-setup';
import { usePaymentPin } from '@/security/pin-provider';
import { useMe } from '@/api/send';

export default function PaymentPinScreen() {
  const { me } = useMe();
  const { reload } = usePaymentPin();
  return <PinSetup handle={me?.handle ?? 'Atlas'} change onCancel={() => router.back()}
    onDone={() => { void reload(); router.back(); }} />;
}
