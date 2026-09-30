import type { BalanceState } from '@/api/balance';
import type { BalanceResponse, SpotPosition } from '@/api/contract';
import type { SpotPositionsState } from '@/api/positions';
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

const ngn = (amount: string) => ({ amount, currency: 'NGN' as const });
const HOUR = 3_600_000;
// Fixed at load so the preview's "held" times read the same on every render.
const LOADED = Date.now();

const SAMPLE_POSITIONS: SpotPosition[] = [
  {
    assetId: 'bonk',
    symbol: 'Bonk',
    name: 'Bonk',
    kind: 'meme',
    chain: 'solana',
    iconUrl: null,
    amount: '1500000',
    invested: ngn('8000'),
    value: ngn('32960'),
    pnl: ngn('24960'),
    pnlPct: '312.00',
    entryPrice: ngn('0.005333'),
    price: ngn('0.021973'),
    realizedPnl: ngn('1200'),
    openedAtUnixMs: LOADED - 52 * HOUR,
  },
  {
    assetId: 'wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    kind: 'meme',
    chain: 'solana',
    iconUrl: null,
    amount: '12',
    invested: ngn('20000'),
    value: ngn('7400'),
    pnl: ngn('-12600'),
    pnlPct: '-63.00',
    entryPrice: ngn('1666.67'),
    price: ngn('616.67'),
    realizedPnl: ngn('0'),
    openedAtUnixMs: LOADED - 5 * HOUR,
  },
];

const samplePositions: SpotPositionsState = {
  data: SAMPLE_POSITIONS,
  error: null,
  reload: async () => {},
};

const sampleState: BalanceState = {
  data: SAMPLE,
  error: null,
  loading: false,
  refresh: async () => {},
};

export default function DevHomePreview() {
  return <HomeContent balance={sampleState} positions={samplePositions} banner="Preview with sample data, not your balance" />;
}
