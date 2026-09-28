import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors } from '@/theme';

// MiniPay-style bottom bar: icons only, pink for the active tab.
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'trade', title: 'Trade', icon: 'trending-up-outline', iconActive: 'trending-up' },
  { name: 'send', title: 'Send', icon: 'paper-plane-outline', iconActive: 'paper-plane' },
  { name: 'more', title: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accentPink,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.bgTabBar, borderTopWidth: 0, height: 72, paddingTop: 10 },
        sceneStyle: { backgroundColor: colors.bgBase },
      }}>
      {TABS.map((t) => (
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
      ))}
    </Tabs>
  );
}
