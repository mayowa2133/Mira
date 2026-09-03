import { Tabs } from 'expo-router';
import { color, space, type } from '@mira/ui';
import { TabIcon } from '@/ui/TabIcon';

/**
 * Primary navigation (`docs/02-design/navigation.md`).
 *
 *   Home   Closet   MIRA   Looks   You
 *
 * Adding garments does NOT consume a tab: `+ Add` is a persistent action in the
 * Home and Closet headers.
 *
 * The Mira tab may carry a slightly distinctive icon, but it must still feel
 * native. It is not a floating action button and not a chat icon (D-010).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.divider,
          borderTopWidth: 1,
          height: space.massive + space.lg,
          paddingTop: space.sm,
        },
        tabBarLabelStyle: {
          fontSize: type.micro.fontSize,
          letterSpacing: type.micro.letterSpacing,
          fontWeight: type.micro.fontWeight,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color: tint }) => <TabIcon name="home" tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color: tint }) => <TabIcon name="closet" tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="mira"
        options={{
          title: 'MIRA',
          tabBarIcon: ({ color: tint }) => <TabIcon name="mira" tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="looks"
        options={{
          title: 'Looks',
          tabBarIcon: ({ color: tint }) => <TabIcon name="looks" tint={tint} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color: tint }) => <TabIcon name="you" tint={tint} />,
        }}
      />
    </Tabs>
  );
}
