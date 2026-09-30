import { useLocalSearchParams } from 'expo-router';

import { MINI_APPS } from '@/components/mini-apps/catalog';
import { MiniBrowser } from '@/components/mini-apps/mini-browser';
import { BackHeader } from '@/components/ui/back-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function MiniAppScreen() {
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const app = MINI_APPS.find((a) => a.id === appId);
  if (!app) {
    return (
      <Screen>
        <BackHeader />
        <Text color="textSecondary">That mini app isn&apos;t available.</Text>
      </Screen>
    );
  }
  return <MiniBrowser app={app} />;
}
