import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES, OCCASIONS, PATTERNS, SEASONS, STYLE_TAGS } from '@mira/taxonomy';
import { color, space, type } from '@mira/ui';
import { ApiError } from '@/lib/api';
import {
  ChipMultiSelect,
  ChipSelect,
  ColorSelect,
  PrimaryButton,
  TextField,
  ToggleField,
  type ChipOption,
} from '@/ui/Fields';
import { colorOptions } from './filter-state';
import {
  EMPTY_FORM,
  isValid,
  setCategory,
  subcategoriesFor,
  toggleIn,
  validateForm,
  type FormErrors,
  type GarmentFormState,
} from './garment-form';

/**
 * Manual garment entry (`docs/01-product/feature-specs.md` — F-01).
 *
 * Manual entry is the fallback path and is always LAST in the add hierarchy, so
 * it asks for as little as possible: only a category is required. Everything
 * else is optional, because Mira exists to remove data entry, not to demand it
 * (CAP-2, the product North Star).
 */
const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const asOptions = (values: readonly string[]): ChipOption[] =>
  values.map((value) => ({ value, label: titleCase(value) }));

const CATEGORY_OPTIONS = asOptions(CATEGORIES);
const SEASON_OPTIONS = asOptions(SEASONS);
const OCCASION_OPTIONS = asOptions(OCCASIONS);
const PATTERN_OPTIONS = asOptions(PATTERNS);
const STYLE_OPTIONS = asOptions(STYLE_TAGS);
const COLOR_OPTIONS = colorOptions();

export type GarmentFormProps = {
  initial?: GarmentFormState;
  submitLabel: string;
  busy: boolean;
  error: unknown;
  onSubmit: (state: GarmentFormState) => void;
  /** Shown under the title. Edit uses it to name the piece being changed. */
  subtitle?: string;
};

export function GarmentForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  subtitle,
}: GarmentFormProps) {
  const [state, setState] = useState<GarmentFormState>(initial ?? EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Subcategories follow the chosen category, and a category change clears a
  // subcategory that no longer belongs to it — so the user never meets a
  // `subcategory_mismatch` from the server.
  const subcategoryOptions = useMemo(
    () => asOptions(subcategoriesFor(state.category)),
    [state.category],
  );

  const update = useCallback(
    <K extends keyof GarmentFormState>(key: K, value: GarmentFormState[K]) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        // Re-validate live once the user has tried to submit, so a corrected
        // field stops showing an error immediately.
        if (submitted) setErrors(validateForm(next));
        return next;
      });
    },
    [submitted],
  );

  const handleCategory = useCallback(
    (value: string | null) => {
      setState((prev) => {
        const next = setCategory(prev, value);
        if (submitted) setErrors(validateForm(next));
        return next;
      });
    },
    [submitted],
  );

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    const found = validateForm(state);
    setErrors(found);
    if (isValid(found)) onSubmit(state);
  }, [onSubmit, state]);

  const apiError = error instanceof ApiError ? error : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {apiError ? (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <Text style={styles.bannerText}>{apiError.message}</Text>
            {apiError.code === 'not_in_taxonomy' || apiError.code === 'subcategory_mismatch' ? (
              <Text style={styles.bannerHint}>Check the category and colour.</Text>
            ) : null}
          </View>
        ) : null}

        <ChipSelect
          label="Category"
          options={CATEGORY_OPTIONS}
          value={state.category}
          onChange={handleCategory}
          error={errors.category}
        />

        {subcategoryOptions.length > 0 ? (
          <ChipSelect
            label="Type"
            options={subcategoryOptions}
            value={state.subcategory}
            onChange={(value) => update('subcategory', value)}
          />
        ) : null}

        <TextField
          label="Brand"
          value={state.brand}
          onChange={(value) => update('brand', value)}
          placeholder="Aritzia"
          autoCapitalize="words"
        />

        <TextField
          label="Name"
          value={state.name}
          onChange={(value) => update('name', value)}
          placeholder="Contour Squareneck Bodysuit"
          autoCapitalize="words"
        />

        <ColorSelect
          label="Colour"
          options={COLOR_OPTIONS}
          // Single primary colour, expressed through the multi-select control.
          values={state.primaryColor ? [state.primaryColor] : []}
          onToggle={(value) => update('primaryColor', state.primaryColor === value ? null : value)}
        />

        <TextField
          label="Size"
          value={state.sizeRaw}
          onChange={(value) => update('sizeRaw', value)}
          placeholder="S"
          autoCapitalize="none"
        />

        <ChipSelect
          label="Pattern"
          options={PATTERN_OPTIONS}
          value={state.pattern}
          onChange={(value) => update('pattern', value)}
        />

        <ChipMultiSelect
          label="Season"
          options={SEASON_OPTIONS}
          values={state.season}
          onToggle={(value) => update('season', toggleIn(state.season, value))}
        />

        <ChipMultiSelect
          label="Occasion"
          options={OCCASION_OPTIONS}
          values={state.occasion}
          onToggle={(value) => update('occasion', toggleIn(state.occasion, value))}
        />

        <ChipMultiSelect
          label="Style"
          options={STYLE_OPTIONS}
          values={state.styleTags}
          onToggle={(value) => update('styleTags', toggleIn(state.styleTags, value))}
        />

        <Text style={styles.section}>Purchase</Text>

        <TextField
          label="Retailer"
          value={state.retailer}
          onChange={(value) => update('retailer', value)}
          placeholder="Zara"
          autoCapitalize="words"
        />

        <TextField
          label="Price"
          value={state.purchasePrice}
          onChange={(value) => update('purchasePrice', value)}
          placeholder="79.90"
          keyboardType="decimal-pad"
          error={errors.purchasePrice}
        />

        <TextField
          label="Purchase date"
          value={state.purchaseDate}
          onChange={(value) => update('purchaseDate', value)}
          placeholder="2026-08-14"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          error={errors.purchaseDate}
        />

        <ToggleField
          label="Still has tags"
          hint="Mira will remind you about pieces you haven't worn yet."
          value={state.tagsAttached}
          onChange={(value) => update('tagsAttached', value)}
        />

        <TextField
          label="Notes"
          value={state.notes}
          onChange={(value) => update('notes', value)}
          placeholder="Anything you want to remember"
          multiline
        />

        <PrimaryButton label={submitLabel} onPress={handleSubmit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  subtitle: {
    marginBottom: space.xxl,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  section: {
    marginTop: space.md,
    marginBottom: space.xl,
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  banner: {
    marginBottom: space.xxl,
    padding: space.lg,
    borderRadius: 12,
    backgroundColor: color.dangerSoft,
  },
  bannerText: { fontSize: type.body.fontSize, color: color.text },
  bannerHint: {
    marginTop: space.xs,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
