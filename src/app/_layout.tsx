import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockGate } from '@/components/LockGate';
import { Banner, Screen } from '@/components/ui';
import { getDb } from '@/lib/db';
import { resumePendingProcessing } from '@/lib/services/capture';
import { purgeExpired } from '@/lib/services/exhibits';
import { loadPrefs } from '@/lib/state/prefs';
import { initLock } from '@/lib/state/lock';
import { initPro } from '@/lib/state/pro';
import { dark, light } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([getDb(), initLock()]);
        await loadPrefs().catch(() => undefined);
        setReady(true);
        void initPro();
        void resumePendingProcessing();
        void purgeExpired().catch(() => undefined);
      } catch (e) {
        setFatal((e as Error).message);
      } finally {
        void SplashScreen.hideAsync();
      }
    })();
  }, []);

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: c.primary,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
    },
  };

  if (fatal) {
    return (
      <Screen>
        <Banner tone="danger" icon="alert-circle" title="ScaniPro could not open its database" body={fatal} />
      </Screen>
    );
  }
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="auto" />
        <LockGate>
          <Stack
            screenOptions={{
              headerTintColor: c.text,
              headerTitleStyle: { color: c.text, fontWeight: '700' },
              headerLargeTitleStyle: { color: c.text, fontWeight: '800' },
              headerShadowVisible: false,
              headerLargeTitleShadowVisible: false,
              // iOS: frosted glass header floating over the ambient glow.
              headerTransparent: Platform.OS === 'ios',
              headerBlurEffect: scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
              headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: c.bg },
              contentStyle: { backgroundColor: c.bg },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Cases', headerLargeTitle: true }} />
            <Stack.Screen name="case/new" options={{ presentation: 'modal', title: 'New Case' }} />
            <Stack.Screen name="case/[id]" options={{ title: '' }} />
            <Stack.Screen name="exhibit/[id]" options={{ title: '' }} />
            <Stack.Screen name="exhibit/annotate" options={{ presentation: 'fullScreenModal', title: 'Annotate & Sign', headerShown: false }} />
            <Stack.Screen name="export/[caseId]" options={{ presentation: 'modal', title: 'Evidence Packet' }} />
            <Stack.Screen name="search" options={{ title: 'Search' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="integrity" options={{ title: 'How Evidence Is Protected' }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'ScaniPro Pro' }} />
            <Stack.Screen name="tools/index" options={{ title: 'Tools' }} />
            <Stack.Screen name="tools/pick" options={{ title: 'Choose Exhibit' }} />
            <Stack.Screen name="tools/text" options={{ title: 'Scan Text' }} />
            <Stack.Screen name="tools/qr" options={{ title: 'QR Code', headerTransparent: true, headerTintColor: '#FFFFFF', headerBlurEffect: undefined }} />
            <Stack.Screen name="tools/merge" options={{ title: 'Merge PDFs' }} />
            <Stack.Screen name="tools/expense" options={{ title: 'Expense Report' }} />
            <Stack.Screen name="trash" options={{ title: 'Recently Deleted' }} />
          </Stack>
        </LockGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
