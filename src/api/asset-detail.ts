import { useEffect, useState } from 'react';
import { engineGet } from '@/api/client';
import type { DisplayCurrency, MarketAsset } from '@/api/contract';
import { errorMessage } from '@/auth/context';

export function useAssetDetail(assetId: string, currency: DisplayCurrency, shortCode?: string) {
  const key = JSON.stringify([assetId, currency, shortCode]);
  const [answer, setAnswer] = useState<{ key: string; asset?: MarketAsset; error?: string } | null>(null);
  useEffect(() => {
    let live = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const asset = await engineGet<MarketAsset>(
          (shortCode ? '/v1/asset-shares/' + encodeURIComponent(shortCode) : '/v1/assets/' + encodeURIComponent(assetId)) + '?currency=' + currency,
          null, { auth: false, timeoutMs: 15_000 });
        if (live && (shortCode || asset.assetId === assetId) && asset.price.currency === currency) setAnswer({ key, asset });
      } catch (e) {
        if (live) setAnswer(previous => previous?.key === key && previous.asset ? previous : { key, error: errorMessage(e) });
      } finally { busy = false; }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => { live = false; clearInterval(timer); };
  }, [assetId, currency, key, shortCode]);
  return { asset: answer?.key === key ? answer.asset ?? null : null,
    error: answer?.key === key ? answer.error ?? null : null };
}
