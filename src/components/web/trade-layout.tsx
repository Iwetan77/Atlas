import type { ReactNode } from 'react';
export type TradeLayoutProps = { market: ReactNode; ticket: ReactNode };
export function TradeLayout({ market, ticket }: TradeLayoutProps) { return <>{market}{ticket}</>; }
