import type { BalanceState } from '@/api/balance';
import type { BalanceResponse } from '@/api/contract';
import { HomeContent } from '@/components/home/home-content';

// Testnet-only design preview of Home with SAMPLE data, labelled on screen. The real Home never
// shows this; it only renders what the engine returns.
const SAMPLE: BalanceResponse = {
  total: { amount: '26600.00', currency: 'NGN' },
  totalUsd: '20.00',
  pending: { amount: '6650.00', currency: 'NGN' },
  holdings: [
    {
      assetId: 'usdc',
      symbol: 'USDC',
      name: 'US Dollar',
      kind: 'cash',
      chain: 'base',
      amount: '10',
      value: { amount: '13300.00', currency: 'NGN' },
      valueUsd: '10.00',
      location: 'gateway',
    },
    {
      assetId: 'usdc',
      symbol: 'USDC',
      name: 'US Dollar',
      kind: 'cash',
      chain: 'base',
      amount: '5',
      value: { amount: '6650.00', currency: 'NGN' },
      valueUsd: '5.00',
      location: 'gateway_pending',
    },
    {
      assetId: 'sol',
      symbol: 'SOL',
      name: 'Solana',
      kind: 'crypto',
      chain: 'solana',
      amount: '0.034',
      value: { amount: '6650.00', currency: 'NGN' },
      valueUsd: '5.00',
    },
    {
      assetId: 'tsla-x',
      symbol: 'TSLAx',
      name: 'Tesla (tokenized)',
      kind: 'stock',
      chain: 'solana',
      amount: '0',
      value: { amount: '0', currency: 'NGN' },
      valueUsd: '0',
    },
  ],
  asOfUnixMs: 0,
};

const sampleState: BalanceState = {
  data: SAMPLE,
  error: null,
  loading: false,
  refresh: async () => {},
};

export default function DevHomePreview() {
  return <HomeContent balance={sampleState} banner="Preview with sample data, not your balance" />;
}
