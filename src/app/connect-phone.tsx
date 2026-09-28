import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAtlasAuth } from '@/auth/context';
import { PhoneOtpForm } from '@/components/phone-otp-form';
import { BackHeader } from '@/components/ui/back-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function ConnectPhoneScreen() {
  const { phoneLink } = useAtlasAuth();

  useEffect(() => {
    if (phoneLink.status === 'done') {
      phoneLink.reset();
      router.back();
    }
  }, [phoneLink]);

  return (
    <Screen>
      <BackHeader />
      <Text variant="title">Connect phone number</Text>
      <Text color="textSecondary">Receive from anyone. Friends on Atlas can pay you with just your number.</Text>
      <PhoneOtpForm flow={phoneLink} submitLabel="Connect" />
    </Screen>
  );
}
