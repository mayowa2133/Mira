import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { color } from '@mira/ui';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { GarmentForm } from '@/features/closet/GarmentForm';
import { toCreatePayload, type GarmentFormState } from '@/features/closet/garment-form';
import { useCreateGarment } from '@/features/closet/queries';

/**
 * Manual add (task 1.6).
 *
 * The last option in the add hierarchy, and deliberately so: every other path
 * exists to avoid this one (`docs/02-design/screen-specs.md` §18).
 */
export default function ManualAddScreen() {
  const router = useRouter();
  const create = useCreateGarment();

  const handleSubmit = useCallback(
    (state: GarmentFormState) => {
      create.mutate(toCreatePayload(state), {
        onSuccess: (garment) => {
          // Replace, so Back from the new garment returns to the closet rather
          // than to the form that created it.
          router.replace(`/garment/${garment.id}`);
        },
      });
    },
    [create, router],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add a piece" closeLabel="Cancel" />
      <GarmentForm
        submitLabel="Add to my closet"
        busy={create.isPending}
        error={create.error}
        onSubmit={handleSubmit}
        subtitle="Only the category is required — Mira fills in the rest as it learns."
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.bg } });
