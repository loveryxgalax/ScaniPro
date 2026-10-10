import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Button, Field, T } from './ui';

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function PromptModal({
  visible,
  title,
  message,
  initial,
  confirmLabel,
  placeholder,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  initial?: string;
  confirmLabel: string;
  placeholder?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible ? (
        <PromptBody title={title} message={message} initial={initial} confirmLabel={confirmLabel} placeholder={placeholder} onCancel={onCancel} onSubmit={onSubmit} />
      ) : null}
    </Modal>
  );
}

function PromptBody({
  title,
  message,
  initial,
  confirmLabel,
  placeholder,
  onCancel,
  onSubmit,
}: {
  title: string;
  message?: string;
  initial?: string;
  confirmLabel: string;
  placeholder?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const c = useTheme();
  const [value, setValue] = useState(initial ?? '');
  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(3,6,14,0.66)', justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: c.surfaceStrong, borderRadius: radius.lg, padding: space.xl, gap: space.md, borderWidth: 1, borderColor: c.border }}>
          <T variant="heading">{title}</T>
          {message ? <T variant="caption">{message}</T> : null}
          <Field label="" value={value} onChangeText={setValue} autoFocus placeholder={placeholder} maxLength={120} onSubmitEditing={() => onSubmit(value)} returnKeyType="done" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button title={confirmLabel} onPress={() => onSubmit(value)} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
