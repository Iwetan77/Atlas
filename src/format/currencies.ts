import type { DisplayCurrency } from '@/api/contract';

// The display currencies Atlas offers, with their flags.
export const CURRENCIES: {
  code: DisplayCurrency;
  label: string;
  flag: string;
}[] = [
  { code: 'NGN', label: 'Nigerian naira', flag: '🇳🇬' },
  { code: 'USD', label: 'US dollar', flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', label: 'British pound', flag: '🇬🇧' },
  { code: 'ZAR', label: 'South African rand', flag: '🇿🇦' },
  { code: 'KES', label: 'Kenyan shilling', flag: '🇰🇪' },
  { code: 'GHS', label: 'Ghanaian cedi', flag: '🇬🇭' },
];
