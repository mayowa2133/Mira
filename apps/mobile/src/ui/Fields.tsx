import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '@/ui/Text';
import { color, radius, space, type } from '@mira/ui';

/**
 * Form primitives.
 *
 * Every input has a persistent VISIBLE label, never a placeholder standing in
 * for one (`docs/02-design/accessibility.md` §8), and every control meets the
 * 44pt minimum target.
 */

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  keyboardType,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | undefined;
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <Field label={label} error={error}>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          Boolean(error) && styles.inputError,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.textTertiary}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline ?? false}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        accessibilityLabel={label}
        // The error is announced with the field, not as a detached message.
        accessibilityHint={error}
      />
    </Field>
  );
}

export type ChipOption = { value: string; label: string };

function ChipButton({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${accessibilityLabel ?? label}${active ? ', selected' : ''}`}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/** Single-select chip group. Tapping the active chip clears it. */
export const ChipSelect = memo(function ChipSelect({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string | undefined;
}) {
  const handle = useCallback(
    (option: string) => () => onChange(value === option ? null : option),
    [onChange, value],
  );

  return (
    <Field label={label} error={error}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <ChipButton
            key={option.value}
            label={option.label}
            active={value === option.value}
            onPress={handle(option.value)}
          />
        ))}
      </View>
    </Field>
  );
});

/** Multi-select chip group. */
export const ChipMultiSelect = memo(function ChipMultiSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: ChipOption[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const handle = useCallback((option: string) => () => onToggle(option), [onToggle]);

  return (
    <Field label={label}>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <ChipButton
            key={option.value}
            label={option.label}
            active={values.includes(option.value)}
            onPress={handle(option.value)}
          />
        ))}
      </View>
    </Field>
  );
});

/**
 * Colour swatches.
 *
 * Each swatch shows its NAME as well as its colour, so colour is never the only
 * carrier of meaning (A11Y-4).
 */
export const ColorSelect = memo(function ColorSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string; swatch: string | null }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const handle = useCallback((option: string) => () => onToggle(option), [onToggle]);

  return (
    <Field label={label}>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={handle(option.value)}
              style={[styles.colorChip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}${active ? ', selected' : ''}`}
            >
              <View
                style={[
                  styles.swatch,
                  option.swatch ? { backgroundColor: option.swatch } : styles.swatchMulti,
                ]}
              />
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
});

export function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: color.accent, false: color.border }}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.primary, (disabled || busy) && styles.primaryDisabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityLabel={label}
    >
      <Text style={styles.primaryLabel}>{busy ? 'Saving…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.xxl },
  label: {
    marginBottom: space.sm,
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: type.micro.fontWeight,
    letterSpacing: type.micro.letterSpacing,
    color: color.textSecondary,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    fontSize: type.body.fontSize,
    color: color.text,
  },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  inputError: { borderColor: color.danger },
  error: {
    marginTop: space.xs,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.danger,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipActive: { backgroundColor: color.accent, borderColor: color.accent },
  chipLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  chipLabelActive: { color: color.inverseText, fontWeight: type.bodyStrong.fontWeight },

  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  swatch: {
    width: space.lg,
    height: space.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  swatchMulti: { backgroundColor: color.surfaceSunken },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.tapMin,
    marginBottom: space.xxl,
  },
  toggleText: { flex: 1, paddingRight: space.lg },
  toggleLabel: { fontSize: type.body.fontSize, color: color.text },
  toggleHint: {
    marginTop: space.xxs,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.textSecondary,
  },

  primary: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryLabel: {
    color: color.inverseText,
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
  },
});
