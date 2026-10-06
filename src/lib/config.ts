import Constants from 'expo-constants';

type Extra = { proProductId?: string; supportUrl?: string; privacyUrl?: string; supportEmail?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  proProductId: process.env.EXPO_PUBLIC_PRO_PRODUCT_ID || extra.proProductId || 'com.hyperadrenax.caseseal.pro',
  supportUrl: extra.supportUrl ?? 'https://caseseal.pages.dev/support',
  privacyUrl: extra.privacyUrl ?? 'https://caseseal.pages.dev/privacy',
  termsUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  supportEmail: extra.supportEmail && extra.supportEmail.includes('@') ? extra.supportEmail : null,
};
