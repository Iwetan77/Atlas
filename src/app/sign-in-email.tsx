import { useAtlasAuth } from '@/auth/context';
import { EmailOtpForm } from '@/components/email-otp-form';
import { BackHeader } from '@/components/ui/back-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function SignInEmailScreen() {
  const { emailLogin } = useAtlasAuth();

  return (
    <Screen>
      <BackHeader />
      <Text variant="title">What&apos;s your email?</Text>
      <Text color="textSecondary">We&apos;ll send you a code. No password to remember.</Text>
      <EmailOtpForm flow={emailLogin} />
    </Screen>
  );
}
