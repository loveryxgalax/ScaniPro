import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Screen, T } from '@/components/ui';
import { radius, space, useTheme } from '@/theme';

export default function QrScreen() {
  const c = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [value, setValue] = useState<string | null>(null);

  if (!permission) return <Screen><T variant="caption">Checking camera access…</T></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Banner icon="camera-outline" title="Camera access needed" body="ScaniPro reads QR codes on this iPhone. Nothing is uploaded." />
        <Button
          title={permission.canAskAgain ? 'Allow Camera' : 'Open iOS Settings'}
          icon="camera"
          onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
        />
      </Screen>
    );
  }

  const onScan = (r: BarcodeScanningResult) => {
    if (value) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setValue(r.data);
  };
  const isUrl = !!value && /^https?:\/\//i.test(value);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerTintColor: value ? c.text : '#FFFFFF', headerTitleStyle: { color: value ? c.text : '#FFFFFF' } }} />
      {!value ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      ) : null}
      {!value ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' }} />
          <T style={{ color: '#fff', marginTop: space.lg, fontWeight: '600' }}>Point at a QR code</T>
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: c.bg, padding: space.lg, paddingTop: 120, gap: space.md }}>
          <T variant="title">QR code</T>
          <Card style={{ borderRadius: radius.lg }}>
            <T selectable variant={isUrl ? 'body' : 'mono'}>{value}</T>
          </Card>
          {isUrl ? (
            <Button
              title="Open Link"
              icon="open-outline"
              onPress={() =>
                Alert.alert('Open this link?', value ?? '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open', onPress: () => void Linking.openURL(value as string) },
                ])
              }
            />
          ) : null}
          <Button
            title="Copy"
            icon="copy-outline"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(value ?? '');
              Alert.alert('Copied');
            }}
          />
          <Button title="Scan Another" icon="qr-code-outline" variant="ghost" onPress={() => setValue(null)} />
        </View>
      )}
    </View>
  );
}
