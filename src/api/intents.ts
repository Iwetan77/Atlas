import { useCallback } from 'react';

import { engineGet, enginePost } from '@/api/client';
import type { ExecutionPlan, IntentStatus, IntentSubmission } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { ActionCancelled, useConfirmAndExecute } from '@/signing/confirm';

type Token = () => Promise<string | null>;

export async function submitIntent(token: Token, intentId: string, body: IntentSubmission): Promise<IntentStatus> {
  return enginePost<IntentStatus>(`/v1/intents/${encodeURIComponent(intentId)}/signed`, await token(), body);
}

const SETTLE_POLL_MS = 2_000;
const SETTLE_TIMEOUT_MS = 120_000;

// Polls until the engine reports the intent filled or failed.
export async function waitForIntent(token: Token, first: IntentStatus): Promise<IntentStatus> {
  let status = first;
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (status.state === 'pending') {
    if (Date.now() > deadline) throw new Error('Still processing. Check your balance in a minute.');
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    status = await engineGet<IntentStatus>(`/v1/intents/${encodeURIComponent(status.intentId)}`, await token());
  }
  return status;
}

// Every money-moving action runs the same way: get the engine's plan, the user confirms it once,
// hand back what was signed/sent, wait for it to settle. Resolves null if the user cancels.
export function useRunIntent() {
  const { getAccessToken } = useAtlasAuth();
  const confirmAndExecute = useConfirmAndExecute();

  return useCallback(
    async (getPlan: () => Promise<ExecutionPlan>, onSettling?: () => void): Promise<IntentStatus | null> => {
      const plan = await getPlan();
      let report;
      try {
        report = await confirmAndExecute(plan);
      } catch (e) {
        if (e instanceof ActionCancelled) return null;
        throw e;
      }
      onSettling?.();
      const first = await submitIntent(getAccessToken, plan.intentId, { sent: report.sent, signed: report.signed });
      return waitForIntent(getAccessToken, first);
    },
    [getAccessToken, confirmAndExecute],
  );
}
