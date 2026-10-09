import { submitPredictionStep } from '@/signing/prediction';
import { predictionGeo } from '@/api/predictions';
import { useCallback, useEffect, useRef } from 'react';

import { engineGet, enginePost, EngineTimeout, EngineUnreachable } from '@/api/client';
import type { ExecutionPlan, IntentStatus, IntentSubmission, SentTx, SignedTx, UnsignedTx } from '@/api/contract';
import { useAtlasAuth } from '@/auth/context';
import { sendOnce, waitForTx } from '@/signing/chains';
import { ActionCancelled, useConfirmAndExecute } from '@/signing/confirm';
import { useSigner } from '@/signing/use-signer';

type Token = () => Promise<string | null>;

const SUBMIT_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 2_000;
const POLL_REQUEST_TIMEOUT_MS = 15_000;
const SETTLE_TIMEOUT_MS = 120_000;
// Moving money to a venue first (perps margin, cash between chains) can take minutes; the engine gives it up to ten.
const FUND_TIMEOUT_MS = 11 * 60_000;

// What was already sent or signed for each step of an intent ('validate', then 'sign'). A step is
// sent once: if reporting it to the engine drops, the same report goes again, and nothing is fetched
// or sent anew (the engine would plan a fresh transaction, and the wallet would send it twice).
const reported = new Map<string, IntentSubmission>();
const stepKey = (intentId: string, stage: string) => `${intentId}:${stage}`;

// Hands the confirmation to the engine. The engine treats a repeat as a no-op that returns the current
// status, so a dropped connection is resent. If it still gets no answer, stop waiting on this call and
// follow the intent's status instead: the engine may already be acting on it, and its status says so.
export async function submitIntent(token: Token, intentId: string, body: IntentSubmission): Promise<IntentStatus & { reportPending?: boolean }> {
  try {
    return await enginePost<IntentStatus>(`/v1/intents/${encodeURIComponent(intentId)}/signed`, await token(), body, {
      timeoutMs: SUBMIT_TIMEOUT_MS,
      retries: 3,
      pinAuthorization: body.pinAuthorization,
    });
  } catch (e) {
    if (!(e instanceof EngineTimeout || e instanceof EngineUnreachable)) throw e;
    return { intentId, stage: 'execute', state: 'pending', txIds: [], error: null, reportPending: true };
  }
}

// The engine hasn't settled the intent within our wait. It isn't a failure: it may still complete.
export class StillSettling extends Error {
  constructor() {
    super('Still processing. Check your balance in a minute.');
  }
}

// Polls until the engine reports the intent filled or failed. A slow or dropped poll is skipped, not fatal.
// Each stage gets its own wait, so a long funding step doesn't eat into the order's.
export async function waitForIntent(
  token: Token,
  first: IntentStatus,
  onStatus?: (status: IntentStatus) => void,
  signNext?: (status: IntentStatus) => Promise<IntentStatus>,
): Promise<IntentStatus> {
  let status = first;
  let stage = status.stage;
  let deadline = Date.now() + (stage === 'fund' ? FUND_TIMEOUT_MS : SETTLE_TIMEOUT_MS);
  onStatus?.(status);
  while (status.state === 'pending') {
    if (status.stage !== stage) {
      reported.delete(stepKey(status.intentId, stage));
      stage = status.stage;
      deadline = Date.now() + (stage === 'fund' ? FUND_TIMEOUT_MS : SETTLE_TIMEOUT_MS);
      onStatus?.(status);
    }
    if (Date.now() > deadline) throw new StillSettling();
    // The engine hasn't seen a step the app already sent (its report was dropped): report it again.
    const unseen = reported.get(stepKey(status.intentId, status.stage));
    if (unseen) {
      try {
        const key = stepKey(status.intentId, status.stage);
        status = await enginePost<IntentStatus>(`/v1/intents/${encodeURIComponent(status.intentId)}/signed`, await token(), unseen, {
          timeoutMs: SUBMIT_TIMEOUT_MS,
          pinAuthorization: unseen.pinAuthorization,
        });
        // An actual HTTP acknowledgement consumes this report, even when the next step is also 'sign'.
        reported.delete(key);
        if (status.state !== 'pending') break;
      } catch (e) {
        if (!(e instanceof EngineTimeout || e instanceof EngineUnreachable)) throw e;
      }
    }
    // The second step is ready: sign it now. A dropped call just means asking again next round.
    else if (status.stage === 'sign' && signNext) {
      try {
        status = await signNext(status);
        continue;
      } catch (e) {
        if (!(e instanceof EngineTimeout || e instanceof EngineUnreachable)) throw e;
      }
    }
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
  const { getAccessToken, wallets, userId } = useAtlasAuth();
  const confirmAndExecute = useConfirmAndExecute();
  const signer = useSigner();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const currentSession = useRef({ signer, base: wallets.base, userId, getAccessToken });
  useEffect(() => { currentSession.current = { signer, base: wallets.base, userId, getAccessToken }; }, [signer, wallets.base, userId, getAccessToken]);

  return useCallback(
    async (
      getPlan: () => Promise<ExecutionPlan>,
      onSettling?: () => void,
      onStatus?: (status: IntentStatus) => void,
    ): Promise<IntentStatus | null> => {
      const owner = userId;
      const session = () => {
        const value = currentSession.current;
        if (!mounted.current || !owner || value.userId !== owner) throw new ActionCancelled();
        return value;
      };
      session();
      // Capture this action's owner token while signing is still allowed. After a broadcast,
      // leaving the screen must not lose its report or report it with a different user's token.
      const ownerToken = await getAccessToken();
      session();
      if (!ownerToken) throw new ActionCancelled();
      const token = async () => {
        const before = currentSession.current;
        if (!mounted.current || before.userId !== owner) return ownerToken;
        try {
          const refreshed = await before.getAccessToken();
          // Funding can outlast an access token. Refresh for the same owner while mounted, but
          // a logout/account switch during refresh must never put another user's token on a report.
          if (!mounted.current || currentSession.current.userId !== owner) return ownerToken;
          return refreshed ?? ownerToken;
        } catch (e) {
          if (!mounted.current || currentSession.current.userId !== owner) return ownerToken;
          throw e;
        }
      };
      const plan = await getPlan();
      session();
      let report;
      try {
        report = await confirmAndExecute(plan);
      } catch (e) {
        if (e instanceof ActionCancelled) return null;
        throw e;
      }
      if (mounted.current && currentSession.current.userId === owner) onSettling?.();
      const initialStage = plan.stage ?? 'validate';
      reported.set(stepKey(plan.intentId, initialStage), { sent: report.sent, signed: report.signed, pinAuthorization: report.pinAuthorization });
      const first = await submitIntent(token, plan.intentId, { sent: report.sent, signed: report.signed, pinAuthorization: report.pinAuthorization });
      if (!first.reportPending) reported.delete(stepKey(plan.intentId, initialStage));
      // A two-step plan (cash moved from another chain first): its last transaction is signed here,
      // covered by the one confirmation the user already gave.
      const signNext = async (status: IntentStatus) => {
        session();
        if (status.intentId.startsWith('prediction-') && !await predictionGeo()) {
          throw new Error('Predictions is not available in your location. Your unused cash stays in your wallet.');
        }
        const next = await engineGet<{ transactions: UnsignedTx[] }>(
          `/v1/intents/${encodeURIComponent(status.intentId)}/next`,
          await token(),
          { timeoutMs: POLL_REQUEST_TIMEOUT_MS, pinAuthorization: report.pinAuthorization },
        );
        // Same rules as the confirm sheet: Solana transactions the engine lands are signed; the rest
        // (Base, after cash arrived from Solana) are sent, each mined before the next.
        const signed: SignedTx[] = [];
        const sent: SentTx[] = [];
        for (const [index, tx] of next.transactions.entries()) {
          const { signer, base } = session();
          if ('typedData' in tx) {
            signed.push({ index, transaction: tx.prediction ? await submitPredictionStep(tx, token, signer, report.pinAuthorization) : await signer.sign(tx) });
            continue;
          }
          if (tx.chain === 'privy') {
            signed.push({ index, transaction: await signer.approve(tx.request) });
            continue;
          }
          if (tx.chain === 'solana' && tx.submit === 'engine') {
            signed.push({ index, transaction: await signer.sign(tx) });
            continue;
          }
          const result = await sendOnce(() => signer.send(tx), tx, base, sent.length > 0);
          await waitForTx(result, tx);
          sent.push(result);
        }
        // The whole step was already signed/sent. Always report it, including after an unmount;
        // the guard above each transaction prevents starting another wallet request afterwards.
        reported.set(stepKey(status.intentId, 'sign'), { sent, signed, pinAuthorization: report.pinAuthorization });
        const answer = await submitIntent(token, status.intentId, { sent, signed, pinAuthorization: report.pinAuthorization });
        if (!answer.reportPending) reported.delete(stepKey(status.intentId, 'sign'));
        return answer;
      };
      const final = await waitForIntent(token, first, (status) => {
        if (mounted.current && currentSession.current.userId === owner) onStatus?.(status);
      }, signNext);
      // A report with no acknowledgement stays available for idempotent replay; a screen closing
      // cannot erase evidence of an already-broadcast step. Terminal status is acknowledgement too.
      if (final.state !== 'pending') {
        reported.delete(stepKey(plan.intentId, initialStage));
        reported.delete(stepKey(plan.intentId, 'sign'));
      }
      return final;
    },
    [getAccessToken, userId, confirmAndExecute],
  );
}
