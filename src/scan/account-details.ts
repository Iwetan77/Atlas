// Bank details read off a QR code or a photo of a sign ("9033935622 MONIEPOINT IVAN WETAN"): the
// account number, and the bank when the text names one. The bank's answer to the number (its
// holder's name) is what confirms it; this only fills the form.
type BankLike = { code: string; name: string };

export type ScannedAccount = { accountNumber: string; bankCode: string | null };

// Names people write that differ from the bank's own (lowercase).
const ALIASES: Record<string, string[]> = {
  guaranty: ['gtb', 'gtbank', 'gt bank', 'guaranty'],
  'united bank for africa': ['uba'],
  'first city monument': ['fcmb'],
  'first bank': ['first bank', 'firstbank'],
  opay: ['opay', 'o-pay'],
  palmpay: ['palmpay', 'palm pay'],
  moniepoint: ['moniepoint', 'monie point', 'moniepont'],
  'stanbic ibtc': ['stanbic'],
};
// Words that don't tell banks apart on their own.
const GENERIC = new Set(['bank', 'plc', 'limited', 'ltd', 'nigeria', 'of', 'the', 'for', 'mfb', 'microfinance', 'first', 'united', 'trust', 'digital', 'services']);

const LOOKALIKES: Record<string, string> = { O: '0', o: '0', Q: '0', D: '0', I: '1', l: '1', '|': '1', S: '5', B: '8' };

export function readAccountDetails(text: string, banks: readonly BankLike[]): ScannedAccount | null {
  const accountNumber = findAccountNumber(text);
  if (!accountNumber) return null;
  return { accountNumber, bankCode: findBank(text, banks)?.code ?? null };
}

// Ten digits, allowing spaces or dashes between groups ("903 393 5622"); an eleven-digit phone
// number with its leading 0 is an OPay-style account number without it.
function findAccountNumber(raw: string): string | null {
  // A letter the reader took for a look-alike digit, between digits: "9O33935622", "50l6...".
  let text = raw;
  for (let i = 0; i < 3; i++) {
    text = text.replace(/(?<=\d[\s-]?)[OoQDIl|SB](?=[\s-]?\d)/g, (c) => LOOKALIKES[c] ?? c);
  }
  for (const match of text.matchAll(/\d(?:[\s-]?\d){9,10}/g)) {
    const digits = match[0].replace(/\D/g, '');
    const before = text[match.index - 1] ?? '';
    const after = text[match.index + match[0].length] ?? '';
    if (/\d/.test(before) || /\d/.test(after)) continue;
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  }
  return null;
}

function findBank(text: string, banks: readonly BankLike[]): BankLike | null {
  const said = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const [bankName, names] of Object.entries(ALIASES)) {
    if (names.some((n) => said.includes(` ${n.replace(/[^a-z0-9]+/g, ' ')} `))) {
      const bank = banks.find((b) => b.name.toLowerCase().includes(bankName));
      if (bank) return bank;
    }
  }
  // Otherwise a bank whose distinctive words all appear ("Zenith", "Kuda", "Wema").
  let best: { bank: BankLike; words: number } | null = null;
  for (const bank of banks) {
    const words = bank.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !GENERIC.has(w));
    if (words.length && words.every((w) => said.includes(` ${w} `)) && (!best || words.length > best.words)) {
      best = { bank, words: words.length };
    }
  }
  return best?.bank ?? null;
}
