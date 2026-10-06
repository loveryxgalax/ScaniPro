import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lockNow, lockStore, unlock } from '@/lib/state/lock';
import { space, useTheme } from '@/theme';

import { AmbientGlow } from './Gradient';
import { Banner, Button, IconChip, T } from './ui';

/**
 * Renders the app behind a Face ID / passcode gate and hides content in the
 * app switcher. Re-locks after the app has been in the background for the
 * configured interval.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, enabled, locked, authenticating, biometryLabel, error } = lockStore.use((s) => s);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);
  const autoPrompted = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      if (next === 'background') backgroundedAt.current = Date.now();
      if (next === 'active' && backgroundedAt.current !== null) {
        const away = (Date.now() - backgroundedAt.current) / 1000;
        backgroundedAt.current = null;
        if (away >= lockStore.get().relockAfter) {
          lockNow();
          autoPrompted.current = false;
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready && enabled && locked && appState === 'active' && !autoPrompted.current) {
      autoPrompted.current = true;
      void unlock();
    }
  }, [ready, enabled, locked, appState]);

  const showLock = ready && enabled && locked;
  const showCover = enabled && appState !== 'active' && !authenticating && !showLock;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showLock || showCover ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, paddingTop: insets.top }]}>
          <AmbientGlow height={700} />
          <View style={{ marginBottom: space.xl, shadowColor: c.shadow, shadowOpacity: 0.7, shadowRadius: 36, shadowOffset: { width: 0, height: 12 } }}>
            <IconChip icon="shield-checkmark" size={104} />
          </View>
          <T variant="display">CaseSeal</T>
          <T variant="caption" style={{ marginTop: 8, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 }}>
            Your case files are locked. Everything stays on this iPhone.
          </T>
          {showLock ? (
            <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: insets.bottom + 40, gap: space.md }}>
              {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
              <Button
                title={`Unlock with ${biometryLabel}`}
                icon={biometryLabel === 'Face ID' ? 'scan' : 'finger-print'}
                onPress={() => void unlock()}
                loading={authenticating}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
