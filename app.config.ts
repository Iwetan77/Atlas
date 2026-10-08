
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';

// EAS file variable / ignored local Firebase client config; no service-account key belongs here.
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ||
    (existsSync('./google-services.json') ? './google-services.json' : undefined);
  if (googleServicesFile) {
    const firebase = JSON.parse(readFileSync(googleServicesFile, 'utf8'));
    const matching = firebase.client?.some((client: { client_info?: { android_client_info?: { package_name?: string } } }) =>
      client.client_info?.android_client_info?.package_name === config.android?.package);
    if (!matching) throw new Error('The Firebase client file does not match the Atlas Android app.');
  }
  return { ...config, name: config.name ?? 'Atlas', slug: config.slug ?? 'atlas',
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    extra: { ...config.extra, androidPushConfigured: !!googleServicesFile },
  };
}
