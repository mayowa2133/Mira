import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { GarmentRail } from '@/features/wardrobe/GarmentRail';
import { useInsights } from '@/features/wardrobe/queries';
import { imageSrc, useClosetSummary, useGarments } from '@/features/closet/queries';
import { useOutfits } from '@/features/outfits/queries';
import { ApiError } from '@/lib/api';

/**
 * Home (`docs/02-design/screen-specs.md` §13).
 *
 * > **Forbidden:** any counts-first block ("You own 328 items · 52 Tops · 31
 * > Dresses"). That is inventory-software thinking.
 *
 * So there is no number anywhere on this screen except inside a sentence. What
 * fills it is imagery and one line of context per rail.
 *
 * Today's look and Ask Mira are Phase 7 and are deliberately absent rather than
 * present and inert. The rails that do not need a model — rediscovery, recently
 * added, still has tags, saved looks — are here now.
 */

/** §13: "few items (<10): hide rediscovery, show 'Keep building your closet'". */
const ENOUGH_TO_NOTICE = 10;

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const summary = useClosetSummary();
  const recent = useGarments({});
  const insights = useInsights(['forgotten', 'tags_attached']);
  const looks = useOutfits('saved');

  const openGarment = useCallback((id: string) => router.push(`/garment/${id}`), [router]);

  const recentGarments = useMemo(
    () =>
      (recent.data?.pages.flatMap((page) => page.data) ?? []).slice(0, 12).map((garment) => ({
        id: garment.id,
        name: garment.name,
        brand: garment.brand?.name ?? garment.brand_raw,
        category: garment.category,
        image_url: imageSrc(garment.canonical_image, 'thumb'),
      })),
    [recent.data],
  );

  const total = summary.data?.total ?? 0;
  const isEmpty = !summary.isPending && total === 0;
  const isSmall = !summary.isPending && total > 0 && total < ENOUGH_TO_NOTICE;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={recent.isRefetching}
          onRefresh={() => {
            void recent.refetch();
            void insights.refetch();
            void summary.refetch();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.greeting} accessibilityRole="header">
          {greeting()}
        </Text>
      </View>

      {summary.isPending ? (
        <ClosetGridSkeleton count={4} />
      ) : isEmpty ? (
        <ClosetState
          message="Let's find what you already own."
          hint="Scan your clothes, a tag, a receipt, or connect your email — Mira does the rest."
          actionLabel="Add your first piece"
          onAction={() => router.push('/add')}
        />
      ) : (
        <>
          {/* A young closet has nothing to rediscover yet, and saying so as an
              absence would be a reproach. It gets an invitation instead. */}
          {isSmall ? (
            <View style={styles.building}>
              <Text style={styles.buildingTitle}>Keep building your closet</Text>
              <Text style={styles.buildingHint}>
                A few more pieces and Mira can start putting looks together.
              </Text>
              <Pressable
                style={styles.buildingCta}
                onPress={() => router.push('/add')}
                accessibilityRole="button"
                accessibilityLabel="Add a piece"
              >
                <Text style={styles.buildingCtaLabel}>Add a piece</Text>
              </Pressable>
            </View>
          ) : (
            (insights.data ?? []).map((insight) => (
              <GarmentRail
                key={insight.kind}
                headline={
                  insight.kind === 'forgotten' ? 'Rediscover your closet' : 'Still has tags 👀'
                }
                caption={insight.kind === 'forgotten' ? insight.headline : undefined}
                garments={insight.garments}
                total={insight.total}
                onPressGarment={openGarment}
                onSeeAll={() => router.push('/insights')}
              />
            ))
          )}

          <GarmentRail
            headline="Recently added"
            garments={recentGarments}
            onPressGarment={openGarment}
          />

          {(looks.data ?? []).length > 0 ? (
            <View style={styles.looks}>
              <Text style={styles.looksTitle} accessibilityRole="header">
                Saved looks
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.looksRail}
              >
                {(looks.data ?? []).slice(0, 8).map((look) => (
                  <Pressable
                    key={look.id}
                    style={styles.lookCell}
                    onPress={() => router.push(`/look/${look.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${look.name ?? 'Look'}, ${look.items.length} pieces`}
                  >
                    <View style={styles.lookCollage}>
                      {look.items
                        .filter((item) => item.image_url)
                        .slice(0, 4)
                        .map((item, _index, shown) => (
                          <Image
                            key={item.garment_id}
                            style={[styles.lookPiece, shown.length === 1 && styles.lookPieceSolo]}
                            source={{ uri: item.image_url as string }}
                            contentFit="cover"
                            accessible={false}
                          />
                        ))}
                    </View>
                    {look.name ? (
                      <Text style={styles.lookName} numberOfLines={1}>
                        {look.name}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {recent.error && recentGarments.length === 0 ? (
            <ClosetState
              message={
                recent.error instanceof ApiError && recent.error.isOffline
                  ? "You're offline."
                  : "We couldn't load your closet."
              }
              actionLabel="Try again"
              onAction={() => void recent.refetch()}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingBottom: space.giant },

  header: { paddingHorizontal: space.screenX, marginBottom: space.xxl },
  date: { fontSize: type.caption.fontSize, color: color.textSecondary },
  greeting: {
    marginTop: space.xs,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },

  building: {
    marginHorizontal: space.screenX,
    marginBottom: space.xxl,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
  },
  buildingTitle: {
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  buildingHint: {
    marginTop: space.xs,
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  buildingCta: {
    marginTop: space.lg,
    minHeight: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingCtaLabel: { fontSize: type.body.fontSize, color: color.inverseText },

  looks: { marginBottom: space.xxl },
  looksTitle: {
    paddingHorizontal: space.screenX,
    marginBottom: space.md,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  looksRail: { paddingHorizontal: space.screenX, gap: space.md },
  lookCell: { width: 132 },
  lookCollage: {
    width: 132,
    aspectRatio: 0.78,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfaceSunken,
  },
  lookPiece: { width: '50%', height: '50%', backgroundColor: color.surfaceSunken },
  lookPieceSolo: { width: '100%', height: '100%' },
  lookName: { marginTop: space.sm, fontSize: type.caption.fontSize, color: color.textSecondary },
});
