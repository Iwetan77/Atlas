// This is a public download location, never a key or token.
const published = 'https://github.com/Iwetan77/Atlas/releases/download/v1.0.1-beta.2/atlas-1.0.1.apk';
const configured = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim() || published;
export const androidApkUrl = configured && /^https:\/\/[^\s]+$/i.test(configured) ? configured : null;
