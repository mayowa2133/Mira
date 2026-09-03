import { View } from 'react-native';
import { radius, space } from '@mira/ui';

export type TabIconName = 'home' | 'closet' | 'mira' | 'looks' | 'you';

/**
 * Placeholder tab icons.
 *
 * Thin line icons at 1.5px stroke replace these in Phase 1
 * (`docs/02-design/design-system.md` §6 — Icons). Shapes differ per tab so the
 * bar is navigable and testable now, and so nothing depends on colour alone
 * (A11Y-4).
 */
export function TabIcon({ name, tint }: { name: TabIconName; tint: string }) {
  const size = space.xxl;
  const common = { width: size, height: size, borderColor: tint, borderWidth: 1.5 };

  switch (name) {
    case 'home':
      return <View accessibilityElementsHidden style={[common, { borderRadius: radius.sm / 2 }]} />;
    case 'closet':
      return <View accessibilityElementsHidden style={[common, { borderRadius: 2 }]} />;
    case 'mira':
      return <View accessibilityElementsHidden style={[common, { borderRadius: radius.full }]} />;
    case 'looks':
      return (
        <View
          accessibilityElementsHidden
          style={[common, { borderRadius: radius.sm, height: size * 0.8 }]}
        />
      );
    case 'you':
      return (
        <View
          accessibilityElementsHidden
          style={[common, { borderRadius: radius.full, width: size * 0.85 }]}
        />
      );
  }
}
