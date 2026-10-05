import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { engineGet } from '@/api/client';

// The Android app has no over-the-air updates: a new version is a new APK. The engine says which
// one is newest (GET /v1/app/android), so the installed app can offer it.
type Release = { latestVersion: string | null; minimumVersion: string | null; downloadUrl: string };
export type AndroidUpdate = { latest: string; required: boolean; downloadUrl: string };

// Compares "1.0.11" with "1.0.9" by number; a pre-release ("1.0.1-beta.2") comes before its release.
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = a.split('-', 2);
  const [coreB, preB] = b.split('-', 2);
  const partsA = coreA.split('.').map(Number);
  const partsB = coreB.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff) return Math.sign(diff);
  }
  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  return 0;
}

// One check per app start, shared by everything that shows it.
let checked: Promise<AndroidUpdate | null> | null = null;
function check(): Promise<AndroidUpdate | null> {
  const installed = Application.nativeApplicationVersion;
  if (Platform.OS !== 'android' || !installed) return Promise.resolve(null);
  checked ??= engineGet<Release>('/v1/app/android', null, { auth: false, timeoutMs: 10_000 })
    .then((r) => {
      if (!r.latestVersion || compareVersions(installed, r.latestVersion) >= 0) return null;
      const required = !!r.minimumVersion && compareVersions(installed, r.minimumVersion) < 0;
      return { latest: r.latestVersion, required, downloadUrl: r.downloadUrl };
    })
    .catch(() => {
      checked = null;
      return null;
    });
  return checked;
}

export function useAndroidUpdate(): AndroidUpdate | null {
  const [update, setUpdate] = useState<AndroidUpdate | null>(null);
  useEffect(() => {
    let live = true;
    void check().then((u) => { if (live) setUpdate(u); });
    return () => { live = false; };
  }, []);
  return update;
}
