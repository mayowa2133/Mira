import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, motion, radius, shadow, space, type } from '@mira/ui';

/**
 * Snackbar with an optional action.
 *
 * This is the affordance behind "undo, not confirm" — a reversible change
 * happens immediately and offers a way back, rather than interrupting the user
 * with a dialog first (`docs/02-design/states-and-errors.md` — Destructive
 * actions).
 */
export type SnackbarOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  /** Errors persist until dismissed; there is nothing to "wait out". */
  tone?: 'default' | 'error';
};

type SnackbarContextValue = { show: (options: SnackbarOptions) => void; dismiss: () => void };

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used inside a SnackbarProvider');
  return context;
}

const DEFAULT_DURATION_MS = 6000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<SnackbarOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  const show = useCallback(
    (options: SnackbarOptions) => {
      clearTimer();
      setCurrent(options);

      // An error stays until the user deals with it. Everything else times out,
      // long enough to notice and react but not long enough to nag.
      if (options.tone !== 'error') {
        timer.current = setTimeout(
          () => setCurrent(null),
          options.durationMs ?? DEFAULT_DURATION_MS,
        );
      }
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? <Snackbar options={current} onDismiss={dismiss} /> : null}
    </SnackbarContext.Provider>
  );
}

function Snackbar({ options, onDismiss }: { options: SnackbarOptions; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Reduced motion keeps the duration but drops the translate, so the
    // completion feedback is never removed — only the movement
    // (`docs/02-design/accessibility.md` §6).
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const handleAction = useCallback(() => {
    options.onAction?.();
    onDismiss();
  }, [options, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.root,
        { bottom: insets.bottom + space.massive },
        {
          opacity: progress,
          transform: reduceMotion
            ? []
            : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.bar, options.tone === 'error' && styles.barError]}
        // Announced without stealing focus, so an undo that appears mid-scroll
        // does not interrupt what the user is doing.
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={options.message}
      >
        <Text style={styles.message} numberOfLines={2}>
          {options.message}
        </Text>

        {options.actionLabel && options.onAction ? (
          <Pressable
            onPress={handleAction}
            hitSlop={space.md}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={`${options.actionLabel}. ${options.message}`}
          >
            <Text style={styles.actionLabel}>{options.actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onDismiss}
            hitSlop={space.md}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.dismissGlyph}>×</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: space.screenX,
    right: space.screenX,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    minHeight: space.massive,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.inverseBg,
    shadowColor: color.text,
    shadowOpacity: 0.1,
    shadowRadius: shadow.float.blur,
    shadowOffset: { width: 0, height: shadow.float.offsetY },
    elevation: 6,
  },
  barError: { backgroundColor: color.danger },
  message: {
    flex: 1,
    color: color.inverseText,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
  },
  action: {
    minWidth: space.tapMin,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  actionLabel: {
    color: color.inverseText,
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
  },
  dismissGlyph: { color: color.inverseText, fontSize: 22, lineHeight: 24 },
});
