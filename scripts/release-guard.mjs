#!/usr/bin/env node
// Blocks production builds that still contain placeholders or that would
// break the app's privacy promise. Runs automatically on EAS through the
// `eas-build-pre-install` hook and manually with `npm run guard:release`.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const profile = process.env.EAS_BUILD_PROFILE;

if (args.has('--if-production') && profile !== 'production') {
  console.log(`[release-guard] profile "${profile ?? 'local'}" is not production, skipping.`);
  process.exit(0);
}

const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

const PLACEHOLDER = /(REPLACE[_-]?WITH|REPLACE_ME|PLACEHOLDER|TODO|CHANGEME|example\.com|xxx+)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function walk(value, path, onString) {
  if (typeof value === 'string') onString(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, onString));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, onString);
  }
}

// 1. app.json
const app = readJson('app.json').expo;
walk(app, 'expo', (s, p) => {
  if (PLACEHOLDER.test(s)) fail(`app.json ${p} contains a placeholder: "${s}"`);
});
if (!app.extra?.eas?.projectId || !UUID.test(app.extra.eas.projectId)) {
  fail('app.json expo.extra.eas.projectId is missing. Run `npx eas-cli@latest init`.');
}
if (!app.ios?.bundleIdentifier) fail('app.json expo.ios.bundleIdentifier is missing.');
const productId = process.env.EXPO_PUBLIC_PRO_PRODUCT_ID || app.extra?.proProductId;
if (!productId || !/^[A-Za-z0-9._-]+$/.test(productId)) {
  fail('Pro in-app purchase product ID is missing (expo.extra.proProductId).');
}
for (const key of ['supportUrl', 'privacyUrl']) {
  if (!/^https:\/\//.test(app.extra?.[key] ?? '')) fail(`app.json expo.extra.${key} must be an https URL.`);
}
const plist = app.ios?.infoPlist ?? {};
for (const key of ['NSCameraUsageDescription', 'NSFaceIDUsageDescription']) {
  if (!plist[key] || plist[key].length < 40) fail(`app.json ios.infoPlist.${key} is missing or too vague.`);
}
const manifest = app.ios?.privacyManifests;
if (!manifest) fail('app.json ios.privacyManifests is missing.');
else {
  if (manifest.NSPrivacyTracking !== false) fail('Privacy manifest must declare NSPrivacyTracking = false.');
  if (!Array.isArray(manifest.NSPrivacyCollectedDataTypes) || manifest.NSPrivacyCollectedDataTypes.length) {
    fail('Privacy manifest must declare an empty NSPrivacyCollectedDataTypes ("Data Not Collected").');
  }
}

if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(app.extra?.supportEmail ?? '')) {
  fail('app.json expo.extra.supportEmail must be a real support address (shown in the app and required by App Review).');
}

// 1b. Hosted privacy/support pages must not ship with placeholders either.
for (const page of ['site/index.html', 'site/privacy.html', 'site/support.html']) {
  const file = join(root, page);
  if (!existsSync(file)) fail(`${page} is missing.`);
  else if (PLACEHOLDER.test(readFileSync(file, 'utf8'))) fail(`${page} still contains a placeholder.`);
}

// 2. eas.json
const eas = readJson('eas.json');
walk(eas, 'eas', (s, p) => {
  if (PLACEHOLDER.test(s)) fail(`eas.json ${p} contains a placeholder: "${s}"`);
});

// 3. No data-collecting SDKs may sneak into the dependency tree.
const pkg = readJson('package.json');
const deps = Object.keys({ ...pkg.dependencies });
const banned = [
  /analytics/i, /firebase/i, /sentry/i, /amplitude/i, /mixpanel/i, /^@segment\//i,
  /bugsnag/i, /datadog/i, /appsflyer/i, /react-native-adjust/i, /react-native-branch/i, /facebook/i,
  /react-native-purchases/i, /onesignal/i, /posthog/i, /expo-updates/i,
];
for (const dep of deps) {
  if (banned.some((re) => re.test(dep))) fail(`Dependency "${dep}" is not allowed: it collects data or calls home.`);
}

// 4. Store icon: 1024x1024 PNG without alpha.
const iconPath = join(root, app.icon ?? '');
if (!existsSync(iconPath)) fail(`App icon not found at ${app.icon}.`);
else {
  const png = readFileSync(iconPath);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];
  if (width !== 1024 || height !== 1024) fail(`App icon must be 1024x1024 (found ${width}x${height}).`);
  if (colorType === 4 || colorType === 6) fail('App icon must not have an alpha channel.');
}

if (errors.length) {
  console.error('\n[release-guard] Production build blocked:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log('[release-guard] All release checks passed.');
