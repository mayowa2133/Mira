import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fontFamilyForWeight } from '@mira/ui';

/**
 * `Text` and `TextInput`, with Mira's typeface applied.
 *
 * These exist because of one iOS behaviour: once `fontFamily` names a custom
 * face, `fontWeight` stops selecting anything. Asking for Archivo at 600 renders
 * Archivo Regular, silently — every heading in the app would look like body
 * copy, and nothing would fail.
 *
 * So the weight is resolved to a family HERE, once, instead of in 199 style
 * objects. Feature code keeps writing `fontWeight: type.title1.fontWeight` and
 * never learns a face name, which is also what keeps
 * `docs/02-design/design-system.md` §10 true — components read tokens, not
 * literals.
 *
 * Import these instead of react-native's, everywhere. `eslint no-restricted-imports`
 * enforces it.
 */
function withFamily(style: TextProps['style']): TextStyle[] {
  // Flatten first: the weight can arrive from any layer of an array style, and
  // reading only the last one gets the wrong face whenever a screen overrides
  // a shared style with its own.
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return [{ fontFamily: fontFamilyForWeight(flat?.fontWeight) }, flat ?? {}];
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={withFamily(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...rest },
  ref,
) {
  return <RNTextInput ref={ref} {...rest} style={withFamily(style as TextProps['style'])} />;
});
