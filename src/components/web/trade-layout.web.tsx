import type { TradeLayoutProps } from './trade-layout';
import { useDesktop } from '@/web/use-desktop';
export function TradeLayout({ market, ticket }: TradeLayoutProps) {
  const desktop = useDesktop();
  if (!desktop) return <>{market}{ticket}</>;
  return <div className="atlas-trade-layout"><section className="atlas-trade-market" aria-label="Market and your position">{market}</section><section className="atlas-trade-order" aria-label="Order details">{ticket}</section></div>;
}
