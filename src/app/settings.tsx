import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';

import { Badge, Card, Divider, Row, Screen, Segmented, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/actionSheet';
import { config } from '@/lib/config';
import { formatBytes } from '@/lib/core/text';
import { deviceContext } from '@/lib/platform/device';
import { clearExports, storageUsedBytes } from '@/lib/platform/files';
import { deleteAllData } from '@/lib/services/cases';
import { lockStore, setLockEnabled, setRelockAfter, type RelockAfter } from '@/lib/state/lock';
import { proStore, restorePro } from '@/lib/state/pro';
import { space } from '@/theme';

export default function SettingsScreen() {
  const { enabled, relockAfter, biometryLabel } = lockStore.use((s) => s);
  const { isPro, purchaseState } = proStore.use((s) => s);
  const [storage, setStorage] = useState(0);
  useQuery(async () => setStorage(storageUsedBytes()), []);
  const device = deviceContext();

  return (
    <Screen>
      <T variant="label">Security</T>
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row
          icon="lock-closed-outline"
          title={`Require ${biometryLabel}`}
          subtitle="Lock ScaniPro and hide it in the app switcher"
          right={<Switch value={enabled} onValueChange={(v) => void setLockEnabled(v)} accessibilityLabel={`Require ${biometryLabel}`} />}
        />
        {enabled ? (
          <View style={{ paddingBottom: space.md, gap: space.sm }}>
            <T variant="caption">Lock again after leaving the app</T>
            <Segmented<string>
              value={String(relockAfter)}
              onChange={(v) => void setRelockAfter(Number(v) as RelockAfter)}
              options={[
                { value: '0', label: 'Immediately' },
                { value: '60', label: '1 minute' },
                { value: '300', label: '5 minutes' },
              ]}
            />
          </View>
        ) : null}
      </Card>

      <T variant="label">ScaniPro Pro</T>
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row icon="star-outline" title={isPro ? 'Pro unlocked' : 'Upgrade to Pro'} subtitle={isPro ? 'Unlimited cases, packets and signatures' : 'One-time purchase'} right={isPro ? <Badge text="Active" tone="success" /> : undefined} onPress={isPro ? undefined : () => router.push('/paywall')} />
        <Divider />
        <Row
          icon="refresh-outline"
          title={purchaseState === 'restoring' ? 'Restoring…' : 'Restore Purchases'}
          onPress={async () => {
            const owned = await restorePro();
            Alert.alert(owned ? 'Restored' : 'Nothing to restore', owned ? 'ScaniPro Pro is unlocked.' : (proStore.get().error ?? 'No previous purchase was found.'));
          }}
        />
      </Card>

      <T variant="label">Privacy</T>
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row icon="phone-portrait-outline" title="Your documents never leave your phone" subtitle="No account, no cloud, no analytics, no tracking. Files leave only when you share them." />
        <Divider />
        <Row icon="shield-checkmark-outline" title="How evidence is protected" onPress={() => router.push('/integrity')} />
        <Divider />
        <Row icon="document-text-outline" title="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)} />
      </Card>

      <T variant="label">Storage</T>
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row icon="folder-outline" title="Evidence stored on this iPhone" right={<T variant="caption">{formatBytes(storage)}</T>} />
        <Divider />
        <Row icon="trash-bin-outline" title="Clear exported copies" subtitle="Removes temporary packet files; evidence is kept" onPress={() => { clearExports(); Alert.alert('Done', 'Temporary export files were removed.'); }} />
      </Card>

      <T variant="label">Support</T>
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row icon="help-buoy-outline" title="Help & Support" onPress={() => void WebBrowser.openBrowserAsync(config.supportUrl)} />
        {config.supportEmail ? (
          <>
            <Divider />
            <Row icon="mail-outline" title="Contact Support" subtitle={config.supportEmail} onPress={() => void Linking.openURL(`mailto:${config.supportEmail}?subject=ScaniPro%20${Application.nativeApplicationVersion ?? ''}%20support`)} />
          </>
        ) : null}
      </Card>

      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        <Row
          icon="warning-outline"
          destructive
          title="Delete All Data…"
          onPress={() =>
            confirm('Delete everything?', 'All cases, exhibits, files and custody logs will be permanently erased from this iPhone. This cannot be undone.', 'Delete Everything', async () => {
              await deleteAllData();
              router.dismissAll();
            })
          }
        />
      </Card>

      <T variant="caption" style={{ textAlign: 'center' }}>
        ScaniPro {device.appVersion} ({device.appBuild}) · {device.deviceModel} · {device.osName} {device.osVersion}
      </T>
    </Screen>
  );
}
