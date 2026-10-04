import { enginePost, SAFE_TO_REPLAY } from '@/api/client';
import type { UnsignedTx } from '@/api/contract';
import { predictionGeo } from '@/api/predictions';
import { runDeviceRequests, type DeviceEnvelope } from '@/signing/prediction-transport';
import type { Signer } from '@/signing/types';

type Token = () => Promise<string | null>;
type TypedStep = Extract<UnsignedTx, { typedData: unknown }>;
const submissions = new Map<string, Promise<string>>();

// Share an in-flight or completed report; tapping twice never signs or posts another order.
export function submitPredictionStep(tx: TypedStep, token: Token, signer: Signer, pinAuthorization: string): Promise<string> {
  const step = tx.prediction;
  if (!step || tx.chain !== 'polygon' || !step.intentId.startsWith('prediction-')) {
    return Promise.reject(new Error('Predictions plan unavailable.'));
  }
  const existing = submissions.get(step.prepareId);
  if (existing) return existing;
  const run = (async () => {
    if (Date.now() >= step.expiresAtUnixMs) throw new Error('Prediction approval expired. Request a fresh quote.');
    if (!await predictionGeo()) throw new Error('Predictions is not available from your device connection.');
    const signature = await signer.sign(tx);
    const envelope = await enginePost<DeviceEnvelope>(
      '/v1/predictions/intents/' + encodeURIComponent(step.intentId) + '/device',
      await token(), { prepareId: step.prepareId, signature, geoAllowed: true }, { ...SAFE_TO_REPLAY, pinAuthorization },
    );
    const results = await runDeviceRequests(envelope);
    // Credentials in an auth result are user-specific. They only go to the authenticated engine, never logs.
    return JSON.stringify({ signature, results, geoAllowed: true });
  })();
  submissions.set(step.prepareId, run);
  // Before a report exists, retrying asks only for the same pinned envelope. The engine's issued
  // checkpoint prevents a fresh approval after a potentially sent mutation.
  void run.catch(() => { submissions.delete(step.prepareId); });
  return run;
}
