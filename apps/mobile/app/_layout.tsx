import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { color } from '@mira/ui';
import { ApiError } from '@/lib/api';

/**
 * Root layout.
 *
 * Onboarding is a separate root stack and is exited, not popped
 * (`docs/02-design/navigation.md` — Rules).
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
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="garment/[id]" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
