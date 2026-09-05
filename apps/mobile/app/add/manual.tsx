import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { color } from '@mira/ui';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { GarmentForm } from '@/features/closet/GarmentForm';
import { DuplicateSheet } from '@/features/closet/DuplicateSheet';
import {
  candidateToAskAbout,
  describeGarment,
  type DuplicateCandidate,
  type DuplicateRelation,
} from '@/features/closet/duplicate-sheet';
import { EMPTY_FORM, toCreatePayload, type GarmentFormState } from '@/features/closet/garment-form';
import { useCheckDuplicate, useCreateGarment } from '@/features/closet/queries';

/**
 * Manual add (task 1.6).
 *
 * The last option in the add hierarchy, and deliberately so: every other path
 * exists to avoid this one (`docs/02-design/screen-specs.md` §18).
 *
 * Every save passes through duplicate detection first (CAP-5). The check runs
 * here rather than being left to the API's 409 because the sheet needs both
 * garments as images (`duplicate-detection.md` §4), and the check is the call
 * that returns them — the 409 is the safety net for a client that skipped this,
 * not the path (D-024).
 */
export default function ManualAddScreen() {
  const router = useRouter();
  const create = useCreateGarment();

  // Carried from the tag scanner (task 4.1). A barcode is worth keeping even
  // when Mira could not read the rest of the label: it is a decisive duplicate
  // signal and what product matching will key on.
  const params = useLocalSearchParams<{ barcode?: string }>();
  const initial: GarmentFormState | undefined = params.barcode
    ? { ...EMPTY_FORM, barcode: params.barcode }
    : undefined;
  const check = useCheckDuplicate();

  // The draft is held while the question is asked, so answering it does not
  // mean retyping the garment.
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [candidate, setCandidate] = useState<DuplicateCandidate | null>(null);

  const open = useCallback(
    (garment: { id: string }) => router.replace(`/garment/${garment.id}`),
    [router],
  );

  const handleSubmit = useCallback(
    (state: GarmentFormState) => {
      const payload = toCreatePayload(state);

      check.mutate(payload, {
        onSuccess: (candidates) => {
          const asking = candidateToAskAbout(candidates);
          if (asking) {
            setPending(payload);
            setCandidate(asking);
            return;
          }
          create.mutate(payload, { onSuccess: open });
        },
      });
    },
    [check, create, open],
  );

  const handleResolve = useCallback(
    (relation: DuplicateRelation) => {
      if (!pending || !candidate) return;

      create.mutate(
        {
          ...pending,
          duplicate_resolution: {
            garment_id: candidate.existing_garment.id,
            relation,
          },
        },
        {
          onSuccess: (garment) => {
            setPending(null);
            setCandidate(null);
            // A merge returns the garment that survived, so this lands on the
            // existing piece rather than on one that was never created.
            open(garment);
          },
        },
      );
    },
    [candidate, create, open, pending],
  );

  const dismiss = useCallback(() => {
    // Nothing is saved. The form still holds everything they typed, so the
    // cost of backing out of the question is zero.
    setPending(null);
    setCandidate(null);
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add a piece" closeLabel="Cancel" />
      <GarmentForm
        submitLabel="Add to my closet"
        busy={create.isPending || check.isPending}
        error={create.error}
        onSubmit={handleSubmit}
        {...(initial ? { initial } : {})}
        subtitle={
          params.barcode
            ? `Barcode ${params.barcode} — only the category is required.`
            : 'Only the category is required — Mira fills in the rest as it learns.'
        }
      />

      <DuplicateSheet
        visible={candidate !== null}
        candidate={candidate}
        incoming={{
          label: pending ? describeGarment(incomingFrom(pending)) : '',
          // A manual entry has no photograph yet; the placeholder is honest
          // about that rather than borrowing the other garment's image.
          imageUri: null,
        }}
        busy={create.isPending}
        onResolve={handleResolve}
        onCancel={dismiss}
      />
    </View>
  );
}

/** The create payload, read back in the shape the comparison line needs. */
function incomingFrom(payload: Record<string, unknown>) {
  const asString = (key: string) =>
    typeof payload[key] === 'string' ? (payload[key] as string) : null;
  return {
    name: asString('name'),
    brand: null,
    brand_raw: asString('brand_raw'),
    category: asString('category') ?? 'other',
    primary_color: asString('primary_color'),
  };
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.bg } });
