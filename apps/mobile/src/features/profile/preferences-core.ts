/**
 * Style preference values and the rules for changing them.
 *
 * Separated from the queries, which import `@/lib/api` → `expo-constants` →
 * React Native, and drag all of it into any test that touches them. Same split
 * as `queue-core.ts`: the part with rules in it stays testable.
 */
export type StylePreferences = {
  preferred_styles: string[];
  avoided_styles: string[];
  preferred_colors: string[];
  avoided_colors: string[];
};

export const EMPTY_PREFERENCES: StylePreferences = {
  preferred_styles: [],
  avoided_styles: [],
  preferred_colors: [],
  avoided_colors: [],
};

/**
 * Toggle a value, keeping the two lists from contradicting each other.
 *
 * The server refuses a contradiction with 422, which is right — but a screen
 * that lets someone build one and then rejects the save is a screen that wasted
 * their time. Choosing a thing removes it from the opposite list here, so the
 * only state this UI can express is a state the server accepts.
 */
export function toggle(
  preferences: StylePreferences,
  field: keyof StylePreferences,
  value: string,
): StylePreferences {
  const opposite: Record<keyof StylePreferences, keyof StylePreferences> = {
    preferred_styles: 'avoided_styles',
    avoided_styles: 'preferred_styles',
    preferred_colors: 'avoided_colors',
    avoided_colors: 'preferred_colors',
  };

  const isOn = preferences[field].includes(value);
  return {
    ...preferences,
    [field]: isOn ? preferences[field].filter((v) => v !== value) : [...preferences[field], value],
    [opposite[field]]: preferences[opposite[field]].filter((v) => v !== value),
  };
}
