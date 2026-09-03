import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { color } from '@mira/ui';
import { ApiError } from '@/lib/api';
import { SnackbarProvider } from '@/ui/Snackbar';
import { bootstrapDevAuth } from '@/lib/dev-auth';
import { useDevInitialRoute } from '@/lib/dev-route';
import { useUploadQueue } from '@/features/capture/queue';

// Development-only: real sign-in is task 0.5 and has no client yet. Inert in
// any release build. See src/lib/dev-auth.ts.
bootstrapDevAuth();

/**
 * Root layout.
 *
 * Onboarding is a separate root stack and is exited, not popped
 * (`docs/02-design/navigation.md` — Rules).
 *
 * The snackbar provider sits above the navigator so an undo survives the
 * navigation that often accompanies the action it is undoing — archiving from
 * the detail screen pops back to the closet, and the undo must still be there.
 */
export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // The closet is browsable from cache; a refetch revalidates behind it.
            gcTime: 24 * 60 * 60 * 1000,
            retry: (failureCount, error) => {
              // Validation and not-found are not worth retrying; offline and
              // 5xx are (docs/02-design/states-and-errors.md — Error taxonomy).
              if (error instanceof ApiError && !error.isRetryable) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SnackbarProvider>
          <DevRoute />
          <UploadQueue />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="garment/[id]" />
            <Stack.Screen name="add/manual" options={{ presentation: 'modal' }} />
            {/* Full-screen: the camera has no nav bar and no tab bar
                (docs/02-design/screen-specs.md §9). */}
            <Stack.Screen
              name="add/scan"
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
            <Stack.Screen name="edit/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </SnackbarProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Drives the capture upload queue for the life of the app.
 *
 * Mounted at the root rather than on the closet, because an upload must keep
 * going while the user is anywhere else — and must resume on foreground even if
 * the closet was never opened.
 */
function UploadQueue() {
  useUploadQueue();
  return null;
}

/** Development-only: see src/lib/dev-route.ts. Renders nothing. */
function DevRoute() {
  useDevInitialRoute();
  return null;
}
