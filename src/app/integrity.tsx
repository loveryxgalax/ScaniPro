import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, IconChip, Screen, T } from '@/components/ui';
import { space } from '@/theme';

const SECTIONS: [keyof typeof Ionicons.glyphMap, string, string][] = [
  ['camera-outline', 'Sealed at capture', 'The moment you finish a scan, every page image is written to the app\'s protected storage, re-read, and fingerprinted with SHA-256. The ordered list of page fingerprints is hashed again into a single capture digest for the exhibit.'],
  ['link-outline', 'Append-only custody log', 'Every action (capture, OCR, PDF generation, rename, annotation, signature, verification, export, share) adds an entry with an ISO 8601 timestamp, device model, OS version, app version and the SHA-256 of the file after the action. The database refuses edits and deletions.'],
  ['git-network-outline', 'Hash-chained entries', 'Each custody entry includes the hash of the entry before it. Changing, removing or reordering any entry breaks the chain, and ScaniPro reports exactly where.'],
  ['git-branch-outline', 'Originals never change', 'Signatures and annotations are saved as new versions with their own SHA-256, linked to the version they came from. Version 1 and the original page images stay byte-for-byte identical.'],
  ['shield-checkmark-outline', 'Verify any time', 'Verify Integrity re-hashes every stored file and re-walks the custody chain. The result is itself recorded in the log.'],
  ['briefcase-outline', 'Independently checkable', 'Evidence packets list every exhibit hash and can embed the exact exhibit files, so a recipient can recompute SHA-256 with standard tools (shasum or certutil) without ScaniPro.'],
  ['phone-portrait-outline', 'Never uploaded', 'Scanning, OCR, hashing and PDF creation all run on this iPhone. There is no account, server, analytics or tracking. Files leave only when you share them.'],
];

export default function IntegrityScreen() {
  return (
    <Screen>
      <T variant="caption" style={{ fontSize: 15 }}>
        ScaniPro is built so that a document you scan today can be shown, later, to be the same document. Here is how.
      </T>
      {SECTIONS.map(([icon, title, body]) => (
        <Card key={title} style={{ flexDirection: 'row', gap: space.md }}>
          <IconChip icon={icon} size={42} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="heading">{title}</T>
            <T variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>{body}</T>
          </View>
        </Card>
      ))}
      <T variant="caption">
        ScaniPro produces records that support authenticity; it is not legal advice. Whether a document is admissible is decided by the rules of your jurisdiction and the court.
      </T>
    </Screen>
  );
}
