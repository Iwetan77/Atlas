import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { engineGet, enginePost, EngineUnavailable, SAFE_TO_REPLAY } from '@/api/client';
import type {
  Bank,
  BankGuess,
  BankRecipient,
  CashLink,
  ExecutionPlan,
  IntentStatus,
  Me,
  Recipient,
  SendQuote,
  SendQuoteRequest,
} from '@/api/contract';
import { errorMessage, useAtlasAuth } from '@/auth/context';

type Token = () => Promise<string | null>;

// Handles: 3–20 of a–z, 0–9, underscore. Normalised the same way the engine checks them.
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const normaliseHandle = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase();

// The signed-in user's profile, shared by every screen and kept on the device, so a screen opens
// showing who they are instead of flashing their email while /v1/me loads.
const ME_KEY = 'atlas.me.v1';
let sharedMe: Me | null = null;
let restored = false;
const meListeners = new Set<() => void>();

function publishMe(next: Me) {
  sharedMe = next;
  meListeners.forEach((listener) => listener());
  AsyncStorage.setItem(ME_KEY, JSON.stringify(next)).catch(() => {});
}

function subscribeMe(listener: () => void) {
  meListeners.add(listener);
  if (!restored) {
    restored = true;
    AsyncStorage.getItem(ME_KEY)
      .then((raw) => {
        if (!raw || sharedMe) return;
        sharedMe = JSON.parse(raw) as Me;
        meListeners.forEach((l) => l());
      })
      .catch(() => {});
  }
  return () => {
    meListeners.delete(listener);
  };
}

export function useMe() {
  const { authenticated, userId, getAccessToken } = useAtlasAuth();
  const stored = useSyncExternalStore(subscribeMe, () => sharedMe);
  // Only this user's profile: never someone's who signed out on this device.
  const me = stored && stored.userId === userId ? stored : null;
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!authenticated) return Promise.resolve();
    return getAccessToken()
      .then((token) => engineGet<Me>('/v1/me', token))
      .then(
        (next) => {
          publishMe(next);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      );
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { me, error, reload, setMe: publishMe };
}

export async function claimHandle(token: Token, handle: string): Promise<Me> {
  const claimed = await enginePost<Me>('/v1/me/handle', await token(), { handle });
  // Every screen shows the new handle at once (the claim's answer carries no photo).
  publishMe(sharedMe?.userId === claimed.userId ? { ...sharedMe, ...claimed } : claimed);
  return claimed;
}

// Returns null when no Atlas user has that handle (engine answers 404).
export async function resolveHandle(token: Token, handle: string): Promise<Recipient | null> {
  try {
    return await engineGet<Recipient>(`/v1/users/resolve?handle=${encodeURIComponent(handle)}`, await token());
  } catch (e) {
    if (e instanceof EngineUnavailable && e.status === 404) return null;
    throw e;
  }
}

export async function listBanks(token: Token): Promise<Bank[]> {
  return (await engineGet<{ banks: Bank[] }>('/v1/offramp/banks?country=NG', await token())).banks;
}

// Returns null when the bank has no such account (engine answers 404).
export async function resolveAccount(token: Token, bankCode: string, accountNumber: string): Promise<string | null> {
  try {
    const res = await enginePost<{ accountName: string }>(
      '/v1/offramp/resolve',
      await token(),
      { bankCode, accountNumber },
      SAFE_TO_REPLAY,
    );
    return res.accountName;
  } catch (e) {
    if (e instanceof EngineUnavailable && e.status === 404) return null;
    throw e;
  }
}

// The banks an account number belongs to, each confirmed with the holder's name.
export async function guessBanks(token: Token, accountNumber: string): Promise<BankGuess[]> {
  return (await enginePost<{ banks: BankGuess[] }>('/v1/offramp/guess', await token(), { accountNumber }, SAFE_TO_REPLAY)).banks;
}

export async function listRecipients(token: Token): Promise<BankRecipient[]> {
  return (await engineGet<{ recipients: BankRecipient[] }>('/v1/offramp/recipients', await token())).recipients;
}

export async function setFavorite(token: Token, bankCode: string, accountNumber: string, favorite: boolean): Promise<BankRecipient[]> {
  return (
    await enginePost<{ recipients: BankRecipient[] }>(
      '/v1/offramp/recipients',
      await token(),
      { bankCode, accountNumber, favorite },
      SAFE_TO_REPLAY,
    )
  ).recipients;
}

export async function requestSendQuote(token: Token, req: SendQuoteRequest): Promise<SendQuote> {
  return enginePost<SendQuote>('/v1/sends/quote', await token(), req, SAFE_TO_REPLAY);
}

export async function executeSend(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/sends/quote/${encodeURIComponent(quoteId)}/execute`, await token(), {}, SAFE_TO_REPLAY);
}

// Public: the claim page shows the link before the claimant has signed in.
export async function getCashLink(linkId: string): Promise<CashLink> {
  return engineGet<CashLink>(`/v1/cashlinks/${encodeURIComponent(linkId)}`, null, { auth: false });
}

// Sets (or with null, removes) the profile photo: a small JPEG data URL.
export async function setAvatar(token: Token, image: string | null): Promise<string | null> {
  return (await enginePost<{ avatar: string | null }>('/v1/me/avatar', await token(), { image })).avatar;
}

export async function claimCashLink(token: Token, linkId: string, secret: string, pinAuthorization: string): Promise<IntentStatus> {
  return enginePost<IntentStatus>(`/v1/cashlinks/${encodeURIComponent(linkId)}/claim`, await token(), { secret }, { pinAuthorization });
}
