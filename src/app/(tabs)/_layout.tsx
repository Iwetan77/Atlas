import { router, Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors } from '@/theme';
import { useDesktop } from '@/web/use-desktop';

// MiniPay-style bottom bar: icons only, pink for the active tab.
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'trade', title: 'Trade', icon: 'trending-up-outline', iconActive: 'trending-up' },
  // Perps is a core screen (spec 4.6), not a mini-app tucked under More.
  { name: 'perps', title: 'Perps', icon: 'pulse-outline', iconActive: 'pulse' },
  { name: 'more', title: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

export default function TabLayout() {
  const desktop = useDesktop();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accentPink,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: desktop ? { display: 'none' } : { backgroundColor: colors.bgTabBar, borderTopWidth: 0, height: 72, paddingTop: 10 },
        sceneStyle: { backgroundColor: colors.bgBase },
      }}>
      {TABS.slice(0, 3).map(tab)}
      {/* Atlas Predictions, the mini app, one tap from anywhere: it opens over the tabs, and back
          returns to where you were. It stays under More's mini apps too. */}
      <Tabs.Screen
        name="predictions-tab"
        options={{
          title: 'Predictions',
          tabBarAccessibilityLabel: 'Atlas Predictions',
          // A grey outline like its neighbours; the planet is Atlas Predictions' logo.
          tabBarIcon: ({ focused }) => (
            <Icon name={focused ? 'planet' : 'planet-outline'} size={26} color={focused ? 'accentPink' : 'textSecondary'} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/predictions');
          },
        }}
      />
      {TABS.slice(3).map(tab)}
      {/* Send lives in Home's Withdraw sheet now; the page stays for the website's sidebar. */}
      <Tabs.Screen name="send" options={{ href: null, title: 'Send' }} />
    </Tabs>
  );
}

function tab(t: (typeof TABS)[number]) {
  return (
    <Tabs.Screen
      key={t.name}
      name={t.name}
      options={{
        title: t.title,
        tabBarAccessibilityLabel: t.title,
        tabBarIcon: ({ focused }) => (
          <Icon name={focused ? t.iconActive : t.icon} size={26} color={focused ? 'accentPink' : 'textSecondary'} />
        ),
      }}
    />
  );
}
