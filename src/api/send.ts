import { useCallback, useEffect, useState } from 'react';

import { engineGet, enginePost, EngineUnavailable } from '@/api/client';
import type {
  Bank,
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

export function useMe() {
  const { authenticated, getAccessToken } = useAtlasAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authenticated) return;
    try {
      setMe(await engineGet<Me>('/v1/me', await getAccessToken()));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { me, error, reload, setMe };
}

export async function claimHandle(token: Token, handle: string): Promise<Me> {
  return enginePost<Me>('/v1/me/handle', await token(), { handle });
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
    const res = await enginePost<{ accountName: string }>('/v1/offramp/resolve', await token(), { bankCode, accountNumber });
    return res.accountName;
  } catch (e) {
    if (e instanceof EngineUnavailable && e.status === 404) return null;
    throw e;
  }
}

export async function requestSendQuote(token: Token, req: SendQuoteRequest): Promise<SendQuote> {
  return enginePost<SendQuote>('/v1/sends/quote', await token(), req);
}

export async function executeSend(token: Token, quoteId: string): Promise<ExecutionPlan> {
  return enginePost<ExecutionPlan>(`/v1/sends/quote/${encodeURIComponent(quoteId)}/execute`, await token(), {});
}

// Public: the claim page shows the link before the claimant has signed in.
export async function getCashLink(linkId: string): Promise<CashLink> {
  return engineGet<CashLink>(`/v1/cashlinks/${encodeURIComponent(linkId)}`, null, { auth: false });
}

export async function claimCashLink(token: Token, linkId: string, secret: string): Promise<IntentStatus> {
  return enginePost<IntentStatus>(`/v1/cashlinks/${encodeURIComponent(linkId)}/claim`, await token(), { secret });
}
