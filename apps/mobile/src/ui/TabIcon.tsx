import { type ColorValue } from 'react-native';
import { Icon, type IconName } from '@/ui/Icon';

export type TabIconName = 'home' | 'closet' | 'mira' | 'looks' | 'you';

/**
 * Tab bar icons (`docs/02-design/design-system.md` §6 — Icons).
 *
 * These were five outlined rectangles and circles for most of the project's
 * life — documented as placeholders "replaced in Phase 1", which never
 * happened. They sat on every screen in the app, which made every screen read
 * as a prototype regardless of what was above them.
 *
 * The Mira tab is a mirror. It is not a sparkle, not a chat bubble and not a
 * floating action button (D-010).
 */
const GLYPH: Record<TabIconName, IconName> = {
  home: 'home',
  closet: 'hanger',
  mira: 'mira',
  looks: 'looks',
  you: 'person',
};

/**
 * The active tab is filled (§6 — Icons: the two exceptions to line icons are the
 * favourite heart and the active tab). Without it the only thing separating the
 * current tab from the rest is a colour, which §2 rule 5 does not allow to
 * carry meaning on its own.
 */
export function TabIcon({
  name,
  tint,
  focused,
}: {
  name: TabIconName;
  tint: ColorValue;
  focused: boolean;
}) {
  return <Icon name={GLYPH[name]} color={tint} size={24} filled={focused} />;
}
