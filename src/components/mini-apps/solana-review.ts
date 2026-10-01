// What a Solana mini app's transaction would do to the user's wallet, found by simulating it on
// mainnet before anything is signed: SOL and tokens leaving and arriving, the network fee, and any
// program Atlas doesn't know. A transaction someone else pays the fee for, or one that would fail,
// comes back with a reason instead, and is never signed.
import {
  type AddressLookupTableAccount,
  PublicKey,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

import { solanaConnection } from '@/signing/chains';

const TOKEN_PROGRAMS = new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';

// Programs that show up in everyday use of the listed mini apps. Anything else gets a warning.
const KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Token accounts',
  ComputeBudget111111111111111111111111111111: 'Compute budget',
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: 'Memo',
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: 'Memo',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter',
  KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD: 'Kamino Lend',
  '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc': 'Kamino Liquidity',
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: 'Meteora DLMM',
  Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: 'Meteora pools',
  cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG: 'Meteora pools',
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: 'Drift',
  stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq: 'Sanctum',
  '5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx': 'Sanctum Infinity',
  SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY: 'Sanctum stake pools',
  SPMBzsVUuoHA4Jm6KunbsotaahvVikZs1JyTW6iJvbn: 'Sanctum stake pools',
  M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K: 'Magic Eden',
  mmm3XBJg5gk8XJxEKBvdgptZz6SgK4tXvn36sodowMc: 'Magic Eden',
  TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN: 'Tensor',
  TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp: 'Tensor',
  TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg: 'Tensor',
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: 'Token metadata',
};

// Names for the coins most mini apps move; any other shows its address, shortened.
const KNOWN_MINTS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'JUP',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'JitoSOL',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'mSOL',
};

export type Change = { label: string; amount: string; positive: boolean };
export type SolanaReview = {
  transaction: VersionedTransaction;
  changes: Change[];
  // The fee in SOL, as text ("0.000005").
  fee: string;
  // Programs Atlas doesn't know (names or shortened addresses): a warning, not a refusal.
  unknown: string[];
  // Set when Atlas won't sign it, in plain words.
  refusal: string | null;
};

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

// Base units → "1.5" (trailing zeros dropped).
export function units(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

// An SPL token account (Token or Token-2022): its mint, owner and amount, from the first 72 bytes.
export function tokenAccount(data: Buffer): { mint: string; owner: string; amount: bigint } | null {
  if (data.length < 165) return null;
  return {
    mint: new PublicKey(data.subarray(0, 32)).toBase58(),
    owner: new PublicKey(data.subarray(32, 64)).toBase58(),
    amount: data.readBigUInt64LE(64),
  };
}

// A simulation error, in words the user can act on.
export function simulationProblem(err: unknown, logs: string[] | null): string {
  const text = JSON.stringify(err) + ' ' + (logs ?? []).join(' ');
  if (/InsufficientFundsForFee|InsufficientFundsForRent|AccountNotFound/i.test(text)) {
    return 'Not enough SOL for network fees. Add a little SOL (Profile → Gas shows your tank) and try again.';
  }
  // Sending more SOL or tokens than the wallet holds.
  if (/insufficient lamports|insufficient funds/i.test(text)) {
    return "This would fail: your wallet doesn't hold enough for it. Nothing was signed.";
  }
  if (/BlockhashNotFound/i.test(text)) return 'The app sent an expired transaction. Try again in the app.';
  return 'This transaction would fail if sent, so Atlas won’t sign it. Nothing was taken.';
}

// Whether `bytes` are a Solana transaction message dressed up as text to sign: signing those would
// approve the transaction.
export function looksLikeTransaction(bytes: Uint8Array): boolean {
  try {
    const message = VersionedMessage.deserialize(bytes);
    return Buffer.from(message.serialize()).equals(Buffer.from(bytes));
  } catch {
    return false;
  }
}

export async function reviewSolanaTransaction(raw: Uint8Array, owner: string): Promise<SolanaReview> {
  const transaction = VersionedTransaction.deserialize(raw);
  const message = transaction.message;
  const result: SolanaReview = { transaction, changes: [], fee: '0', unknown: [], refusal: null };
  const payer = message.staticAccountKeys[0]?.toBase58();
  if (payer !== owner) {
    result.refusal = 'This transaction has someone else paying its fee, so Atlas won’t sign it.';
    return result;
  }
  // Every account it touches, lookup tables included.
  const tables: AddressLookupTableAccount[] = [];
  for (const lookup of message.addressTableLookups) {
    const table = (await solanaConnection.getAddressLookupTable(lookup.accountKey)).value;
    if (!table) {
      result.refusal = 'This transaction refers to accounts Atlas can’t find, so it won’t sign it.';
      return result;
    }
    tables.push(table);
  }
  const keys = message.getAccountKeys({ addressLookupTableAccounts: tables });
  const all: string[] = [];
  for (let i = 0; i < keys.length; i++) all.push(keys.get(i)!.toBase58());
  const watched = [...new Set([owner, ...all])].slice(0, 100);

  result.unknown = [
    ...new Set(
      message.compiledInstructions
        .map((ix) => message.staticAccountKeys[ix.programIdIndex]?.toBase58() ?? '')
        .filter((program) => !KNOWN_PROGRAMS[program])
        .map(short),
    ),
  ];

  const [before, simulation, fee] = await Promise.all([
    solanaConnection.getMultipleAccountsInfo(watched.map((a) => new PublicKey(a))),
    solanaConnection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: { encoding: 'base64', addresses: watched },
    }),
    solanaConnection.getFeeForMessage(message),
  ]);
  const feeLamports = BigInt(fee.value ?? 5000);
  result.fee = units(feeLamports, 9);
  if (simulation.value.err) {
    result.refusal = simulationProblem(simulation.value.err, simulation.value.logs);
    return result;
  }
  const after = simulation.value.accounts ?? [];
  const balance = BigInt(before[0]?.lamports ?? 0);
  if (balance < feeLamports) {
    result.refusal = simulationProblem('InsufficientFundsForFee', null);
    return result;
  }

  // SOL: the wallet's own lamports, with the fee taken out (it has its own line), plus wrapped SOL.
  let sol = BigInt(after[0]?.lamports ?? 0) - balance + feeLamports;
  const tokens = new Map<string, bigint>();
  watched.forEach((address, i) => {
    const pre = before[i];
    const post = after[i];
    const read = (owned: string | undefined, data: Buffer | null) =>
      owned && TOKEN_PROGRAMS.has(owned) && data ? tokenAccount(data) : null;
    const was = read(pre?.owner.toBase58(), pre ? Buffer.from(pre.data) : null);
    const now = read(post?.owner, post ? Buffer.from(post.data[0], 'base64') : null);
    const mint = now?.mint ?? was?.mint;
    if (!mint || (now?.owner ?? was?.owner) !== owner) return;
    const delta = (now?.amount ?? 0n) - (was?.amount ?? 0n);
    if (mint === WRAPPED_SOL) sol += delta;
    else if (delta !== 0n) tokens.set(mint, (tokens.get(mint) ?? 0n) + delta);
  });

  if (sol !== 0n) result.changes.push({ label: 'SOL', amount: units(sol, 9), positive: sol > 0n });
  if (tokens.size) {
    const mints = [...tokens.keys()];
    const infos = await solanaConnection.getMultipleAccountsInfo(mints.map((m) => new PublicKey(m)));
    mints.forEach((mint, i) => {
      const data = infos[i]?.data;
      const decimals = data && data.length >= 45 ? data[44] : 0;
      const delta = tokens.get(mint)!;
      if (delta === 0n) return;
      result.changes.push({ label: KNOWN_MINTS[mint] ?? short(mint), amount: units(delta, decimals), positive: delta > 0n });
    });
  }
  return result;
}
