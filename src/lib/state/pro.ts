import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { config } from '../config';
import { createStore } from './store';

const CACHE_KEY = 'scanipro.pro.v1';

export type PriceState = 'idle' | 'loading' | 'ready' | 'error';
export type PurchaseState = 'idle' | 'purchasing' | 'pending' | 'restoring';

type ProState = {
  isPro: boolean;
  /** True once we've reconciled with the store at least once this session. */
  verified: boolean;
  product: Product | null;
  priceState: PriceState;
  purchaseState: PurchaseState;
  message: string | null;
  error: string | null;
};

export const proStore = createStore<ProState>({
  isPro: false,
  verified: false,
  product: null,
  priceState: 'idle',
  purchaseState: 'idle',
  message: null,
  error: null,
});

export const useIsPro = () => proStore.use((s) => s.isPro);

let connected = false;
let listenersAttached = false;

function ownsPro(purchases: Purchase[]): boolean {
  return purchases.some(
    (p) =>
      p.productId === config.proProductId &&
      p.purchaseState === 'purchased' &&
      !('revocationDateIOS' in p && p.revocationDateIOS),
  );
}

async function setPro(isPro: boolean) {
  proStore.set({ isPro });
  try {
    if (isPro) await SecureStore.setItemAsync(CACHE_KEY, '1');
    else await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch {
    // Keychain unavailable: the store remains the source of truth.
  }
}

function errorText(e: PurchaseError | Error | unknown): string {
  const code = (e as PurchaseError)?.code;
  switch (code) {
    case ErrorCode.NetworkError:
      return 'The App Store could not be reached. Check your connection and try again.';
    case ErrorCode.ItemUnavailable:
      return 'ScaniPro Pro is not available in your region right now.';
    case ErrorCode.AlreadyOwned:
      return 'You already own ScaniPro Pro. Tap Restore Purchases.';
    case ErrorCode.NotPrepared:
    case ErrorCode.ServiceError:
      return 'The App Store is temporarily unavailable. Please try again shortly.';
    default:
      return (e as Error)?.message || 'The purchase could not be completed.';
  }
}

async function handlePurchase(purchase: Purchase) {
  if (purchase.productId !== config.proProductId) return;
  if (purchase.purchaseState === 'pending') {
    proStore.set({
      purchaseState: 'pending',
      message: 'Purchase pending approval (for example, Ask to Buy). Pro unlocks automatically once it is approved.',
      error: null,
    });
    return;
  }
  if (purchase.purchaseState === 'purchased') {
    await setPro(true);
    proStore.set({ purchaseState: 'idle', message: 'ScaniPro Pro is unlocked. Thank you!', error: null });
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch (e) {
      console.warn('finishTransaction failed', e);
    }
  }
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  purchaseUpdatedListener((p) => {
    void handlePurchase(p);
  });
  purchaseErrorListener((e) => {
    if (e.code === ErrorCode.UserCancelled) {
      proStore.set({ purchaseState: 'idle', error: null, message: null });
    } else if (e.code === ErrorCode.DeferredPayment || e.code === ErrorCode.Pending) {
      proStore.set({
        purchaseState: 'pending',
        message: 'Purchase pending approval (for example, Ask to Buy). Pro unlocks automatically once it is approved.',
        error: null,
      });
    } else {
      proStore.set({ purchaseState: 'idle', error: errorText(e), message: null });
    }
  });
}

async function ensureConnected() {
  if (connected) return;
  attachListeners();
  await initConnection();
  connected = true;
}

/** Called at launch: show cached state immediately, then reconcile with StoreKit. */
export async function initPro() {
  try {
    if ((await SecureStore.getItemAsync(CACHE_KEY)) === '1') proStore.set({ isPro: true });
  } catch {
    // ignore
  }
  if (Platform.OS === 'web') return;
  try {
    await ensureConnected();
    const purchases = await getAvailablePurchases();
    // Only downgrade after a successful store query, so offline users keep Pro.
    await setPro(ownsPro(purchases));
    proStore.set({ verified: true });
    for (const p of purchases) if (p.purchaseState === 'pending') await handlePurchase(p);
  } catch (e) {
    console.warn('IAP init failed', e);
  }
  void loadPrice();
}

export async function loadPrice() {
  proStore.set({ priceState: 'loading' });
  try {
    await ensureConnected();
    const products = (await fetchProducts({ skus: [config.proProductId], type: 'in-app' })) as Product[] | null;
    const product = products?.find((p) => p.id === config.proProductId) ?? null;
    proStore.set({ product, priceState: product ? 'ready' : 'error' });
  } catch (e) {
    console.warn('fetchProducts failed', e);
    proStore.set({ priceState: 'error' });
  }
}

export async function buyPro() {
  const { product, purchaseState } = proStore.get();
  if (!product || purchaseState === 'purchasing') return;
  proStore.set({ purchaseState: 'purchasing', error: null, message: null });
  try {
    await ensureConnected();
    await requestPurchase({
      request: { apple: { sku: config.proProductId }, google: { skus: [config.proProductId] } },
      type: 'in-app',
    });
    // The outcome arrives through the listeners above.
  } catch (e) {
    const code = (e as PurchaseError)?.code;
    if (code === ErrorCode.UserCancelled) proStore.set({ purchaseState: 'idle' });
    else proStore.set({ purchaseState: 'idle', error: errorText(e) });
  }
}

export async function restorePro(): Promise<boolean> {
  proStore.set({ purchaseState: 'restoring', error: null, message: null });
  try {
    await ensureConnected();
    await restorePurchases();
    const purchases = await getAvailablePurchases();
    const owned = ownsPro(purchases);
    await setPro(owned);
    proStore.set({
      purchaseState: 'idle',
      verified: true,
      message: owned ? 'Your ScaniPro Pro purchase was restored.' : null,
      error: owned ? null : 'No previous ScaniPro Pro purchase was found for this Apple Account.',
    });
    return owned;
  } catch (e) {
    proStore.set({ purchaseState: 'idle', error: errorText(e) });
    return false;
  }
}

export function clearProMessages() {
  proStore.set({ message: null, error: null });
}
