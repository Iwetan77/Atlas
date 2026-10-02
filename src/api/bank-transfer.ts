import { engineGet, enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { BankTransfer, BankTransferQuote, DisplayCurrency } from '@/api/contract';

type Token = () => Promise<string | null>;

// What a naira bank transfer would add; nothing is opened yet.
export async function quoteBankTransfer(token: Token, naira: string, currency: DisplayCurrency): Promise<BankTransferQuote> {
  return enginePost<BankTransferQuote>('/v1/onramp/bank/quote', await token(), { amount: naira, currency }, SAFE_TO_REPLAY);
}

// Opens a one-time account. Not replayed: a retry would open a second one.
export async function openBankTransfer(token: Token, naira: string, currency: DisplayCurrency): Promise<BankTransfer> {
  return enginePost<BankTransfer>('/v1/onramp/bank', await token(), { amount: naira, currency });
}

export async function bankTransferStatus(token: Token, id: string, currency: DisplayCurrency): Promise<BankTransfer> {
  return engineGet<BankTransfer>(`/v1/onramp/bank/${encodeURIComponent(id)}?currency=${currency}`, await token());
}
