import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { color, space } from '@mira/ui';
import { ApiError } from '@/lib/api';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { GarmentForm } from '@/features/closet/GarmentForm';
import {
  formFromGarment,
  toUpdatePayload,
  type GarmentFormState,
} from '@/features/closet/garment-form';
import { useGarment, useUpdateGarment } from '@/features/closet/queries';

/**
 * Edit a garment (task 1.6).
 *
 * Every AI-generated field is user-editable (AI-5, D-007), and a correction
 * always wins over what a model said. `source_type` is absent from this form
 * because provenance is immutable (CAP-3).
 */
export default function EditGarmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const garment = useGarment(id ?? '');
  const update = useUpdateGarment(id ?? '');

  const initial = useMemo(
    () => (garment.data ? formFromGarment(garment.data) : undefined),
    [garment.data],
  );

  const handleSubmit = useCallback(
    (state: GarmentFormState) => {
      if (!initial) return;
      const patch = toUpdatePayload(initial, state);
      if (Object.keys(patch).length === 0) {
        router.back();
        return;
      }
      update.mutate(patch, { onSuccess: () => router.back() });
    },
    [initial, router, update],
  );

  if (garment.isPending) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Edit" closeLabel="Cancel" />
        <ScrollView contentContainerStyle={styles.pad}>
          <ClosetGridSkeleton count={2} />
        </ScrollView>
      </View>
    );
  }

  if (garment.error || !garment.data || !initial) {
    const apiError = garment.error instanceof ApiError ? garment.error : null;
    const gone = apiError?.status === 404;
    return (
      <View style={styles.root}>
        <ScreenHeader title="Edit" closeLabel="Cancel" />
        <ScrollView contentContainerStyle={styles.pad}>
          <ClosetState
            message={
              gone ? "This piece isn't in your closet any more." : "We couldn't load this piece."
            }
            actionLabel={gone ? 'Back to closet' : 'Try again'}
            onAction={gone ? () => router.back() : () => void garment.refetch()}
          />
        </ScrollView>
      </View>
    );
  }

  const name = garment.data.name ?? garment.data.brand?.name ?? 'this piece';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit" closeLabel="Cancel" />
      <GarmentForm
        initial={initial}
        submitLabel="Save changes"
        busy={update.isPending}
        error={update.error}
        onSubmit={handleSubmit}
        subtitle={`Correcting ${name}. Your edits always win over what Mira guessed.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  pad: { paddingHorizontal: space.screenX },
});
