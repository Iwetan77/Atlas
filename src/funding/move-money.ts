import { router } from 'expo-router';

import type { MoveDirection } from '@/api/contract';

// Opens Move money: Spendable → Trading to add money for trading, or back the other way.
// `amount` (in the display currency) is filled in, e.g. what a trade is short of.
export function openMove(direction: MoveDirection, amount?: number) {
  const params: { direction: MoveDirection; amount?: string } = { direction };
  if (amount && Number.isFinite(amount) && amount > 0) params.amount = (Math.ceil(amount * 100) / 100).toFixed(2);
  router.push({ pathname: '/move', params });
}
