import { useAtlasAuth } from '@/auth/context';
import { PhoneOtpForm } from '@/components/phone-otp-form';
import { BackHeader } from '@/components/ui/back-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function SignInPhoneScreen() {
  const { phoneLogin } = useAtlasAuth();

  return (
    <Screen>
      <BackHeader />
      <Text variant="title">What&apos;s your phone number?</Text>
      <Text color="textSecondary">Friends on Atlas can send you money with just this number.</Text>
      <PhoneOtpForm flow={phoneLogin} submitLabel="Continue" />
    </Screen>
  );
}
