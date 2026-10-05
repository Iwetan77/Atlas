import { engineGet, enginePost } from '@/api/client';

export type PinStatus = { configured: boolean; lockedUntilUnixMs: number | null };
export type PinAction =
  | { type: 'intent'; intentId: string }
  | { type: 'tpsl'; positionId: string; takeProfitPct: number | null; stopLossPct: number | null }
  | { type: 'cashlink'; linkId: string; secret: string }
  | { type: 'wallet'; origin: string; request: { method: string; params: unknown } };
export type PinAuthorization = { authorization: string; expiresAtUnixMs: number };
export type Token = () => Promise<string | null>;

export const pinStatus = async (token: Token) =>
  engineGet<PinStatus>('/v1/me/pin', await token(), { timeoutMs: 15_000 });

export const setPin = async (token: Token, pin: string, confirmation: string, currentPin?: string) =>
  enginePost<PinStatus>('/v1/me/pin', await token(), { pin, confirmation, currentPin }, { timeoutMs: 20_000 });

export const authorizePin = async (token: Token, pin: string, action: PinAction) =>
  enginePost<PinAuthorization>('/v1/me/pin/authorize', await token(), { pin, action }, { timeoutMs: 20_000 });

export const consumePin = async (token: Token, authorization: string, action: PinAction) =>
  enginePost('/v1/me/pin/consume', await token(), { authorization, action }, { timeoutMs: 15_000 });

// The lock screen: checks the PIN (same tries and lockouts) without approving any payment.
export const unlockWithPin = async (token: Token, pin: string) =>
  enginePost<{ unlocked: boolean }>('/v1/me/pin/verify', await token(), { pin }, { timeoutMs: 20_000 });
