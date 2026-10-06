import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, Screen, T } from '@/components/ui';
import { config } from '@/lib/config';
import type { ProFeature } from '@/lib/core/limits';
import { FREE_LIMITS } from '@/lib/core/limits';
import { buyPro, clearProMessages, loadPrice, proStore, restorePro } from '@/lib/state/pro';
import { space, useTheme } from '@/theme';

const REASONS: Record<ProFeature, string> = {
  unlimited_cases: `The free version includes ${FREE_LIMITS.cases} case.`,
  unlimited_exhibits: `The free version includes ${FREE_LIMITS.exhibits} exhibits.`,
  packet_export: 'Evidence packet export is a Pro feature.',
  signatures: 'Signatures and annotations are Pro features.',
};

const BENEFITS: [keyof typeof Ionicons.glyphMap, string, string][] = [
  ['briefcase', 'Unlimited cases', 'One case per matter, as many matters as you need.'],
  ['documents', 'Unlimited exhibits', 'Scan every page of every record.'],
  ['albums', 'Evidence packet export', 'Cover page, exhibit index, stamped exhibits, hash manifest, CSV and JSON.'],
  ['create', 'Signatures & annotations', 'Saved as linked versions. The original stays untouched.'],
];

export default function PaywallScreen() {
  const { feature } = useLocalSearchParams<{ feature?: ProFeature }>();
  const c = useTheme();
  const { isPro, product, priceState, purchaseState, message, error } = proStore.use((s) => s);

  useEffect(() => {
    clearProMessages();
    if (priceState !== 'ready') void loadPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPro && purchaseState === 'idle' && message) {
      const t = setTimeout(() => router.back(), 1200);
      return () => clearTimeout(t);
    }
  }, [isPro, purchaseState, message]);

  const buyLabel =
    priceState === 'ready' && product
      ? `Unlock Pro · ${product.displayPrice}`
      : priceState === 'loading' || priceState === 'idle'
        ? 'Loading price…'
        : 'Price unavailable';

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Button title="Close" variant="ghost" onPress={() => router.back()} style={{ minHeight: 36, paddingHorizontal: 0 }} />
          ),
        }}
      />
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={38} color={c.primaryText} />
        </View>
        <T variant="title" style={{ textAlign: 'center' }}>ScaniPro Pro</T>
        <T variant="caption" style={{ textAlign: 'center', fontSize: 15 }}>One-time purchase. No subscription, no account.</T>
      </View>

      {feature && REASONS[feature] && !isPro ? <Banner icon="information-circle" title={REASONS[feature]} body="Upgrade once to remove every limit." /> : null}
      {isPro ? <Banner tone="success" icon="checkmark-circle" title="Pro is unlocked on this Apple Account" body="Thank you for supporting private, on-device software." /> : null}

      <Card style={{ gap: space.lg }}>
        {BENEFITS.map(([icon, title, body]) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md }}>
            <Ionicons name={icon} size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <T variant="heading" style={{ fontSize: 16 }}>{title}</T>
              <T variant="caption">{body}</T>
            </View>
          </View>
        ))}
      </Card>

      {purchaseState === 'pending' ? <Banner tone="warning" icon="time-outline" title="Waiting for approval" body={message ?? undefined} /> : null}
      {message && purchaseState !== 'pending' ? <Banner tone="success" icon="checkmark-circle" title={message} /> : null}
      {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
      {priceState === 'error' && !isPro ? (
        <Banner tone="warning" icon="cloud-offline-outline" title="Couldn't load the price from the App Store" body="Check your internet connection. Your documents never need a connection; only the purchase does.">
          <Button title="Try Again" variant="ghost" icon="refresh" onPress={() => void loadPrice()} style={{ alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 }} />
        </Banner>
      ) : null}

      {!isPro ? (
        <Button
          title={purchaseState === 'pending' ? 'Purchase Pending' : buyLabel}
          icon="lock-open"
          onPress={() => void buyPro()}
          loading={purchaseState === 'purchasing'}
          disabled={priceState !== 'ready' || purchaseState !== 'idle'}
        />
      ) : (
        <Button title="Done" onPress={() => router.back()} />
      )}
      <Button title="Restore Purchases" variant="ghost" onPress={() => void restorePro()} loading={purchaseState === 'restoring'} disabled={purchaseState === 'purchasing'} />

      <T variant="caption" style={{ textAlign: 'center' }}>
        Payment is charged to your Apple Account at confirmation. The purchase is non-consumable and is restored on any device signed in to the same Apple Account. Family Sharing may apply.
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
        <Button title="Privacy Policy" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)} style={{ minHeight: 36 }} />
        <Button title="Terms of Use" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(config.termsUrl)} style={{ minHeight: 36 }} />
      </View>
    </Screen>
  );
}
