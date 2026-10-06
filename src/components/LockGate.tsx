import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lockNow, lockStore, unlock } from '@/lib/state/lock';
import { space, useTheme } from '@/theme';

import { Banner, Button, T } from './ui';

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
          <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
            <Ionicons name="shield-checkmark" size={46} color={c.primaryText} />
          </View>
          <T variant="title">ScaniPro</T>
          <T variant="caption" style={{ marginTop: 6, textAlign: 'center' }}>
            Your case files are locked. Everything stays on this iPhone.
          </T>
          {showLock ? (
            <View style={{ width: '100%', marginTop: space.xxl, gap: space.md }}>
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
