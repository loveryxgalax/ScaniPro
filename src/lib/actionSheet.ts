import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type SheetOption = { label: string; onPress: () => void; destructive?: boolean };

export function showActionSheet(title: string, options: SheetOption[]) {
  if (Platform.OS === 'ios') {
    const destructiveButtonIndex = options.map((o, i) => (o.destructive ? i : -1)).filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length, destructiveButtonIndex },
      (i) => options[i]?.onPress(),
    );
  } else {
    Alert.alert(title, undefined, [
      ...options.map((o) => ({ text: o.label, onPress: o.onPress, style: o.destructive ? ('destructive' as const) : ('default' as const) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

export function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
