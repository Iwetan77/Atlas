import { useCallback } from 'react';

import { engineGet, enginePost, EngineTimeout, EngineUnreachable } from '@/api/client';
import type { ExecutionPlan, IntentStatus, IntentSubmission } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { ActionCancelled, useConfirmAndExecute } from '@/signing/confirm';

type Token = () => Promise<string | null>;

const SUBMIT_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 2_000;
const POLL_REQUEST_TIMEOUT_MS = 15_000;
const SETTLE_TIMEOUT_MS = 120_000;

// Hands the confirmation to the engine. The engine treats a repeat as a no-op that returns the current
// status, so a dropped connection is resent. If it still gets no answer, stop waiting on this call and
// follow the intent's status instead: the engine may already be acting on it, and its status says so.
export async function submitIntent(token: Token, intentId: string, body: IntentSubmission): Promise<IntentStatus> {
  try {
    return await enginePost<IntentStatus>(`/v1/intents/${encodeURIComponent(intentId)}/signed`, await token(), body, {
      timeoutMs: SUBMIT_TIMEOUT_MS,
      retries: 3,
    });
  } catch (e) {
    if (!(e instanceof EngineTimeout || e instanceof EngineUnreachable)) throw e;
    return { intentId, stage: 'execute', state: 'pending', txIds: [], error: null };
  }
}

// The engine hasn't settled the intent within our wait. It isn't a failure: it may still complete.
export class StillSettling extends Error {
  constructor() {
    super('Still processing. Check your balance in a minute.');
  }
}

// Polls until the engine reports the intent filled or failed. A slow or dropped poll is skipped, not fatal.
export async function waitForIntent(token: Token, first: IntentStatus): Promise<IntentStatus> {
  let status = first;
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (status.state === 'pending') {
    if (Date.now() > deadline) throw new StillSettling();
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    try {
      status = await engineGet<IntentStatus>(`/v1/intents/${encodeURIComponent(status.intentId)}`, await token(), {
        timeoutMs: POLL_REQUEST_TIMEOUT_MS,
      });
    } catch (e) {
      if (!(e instanceof EngineTimeout || e instanceof EngineUnreachable)) throw e;
    }
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
