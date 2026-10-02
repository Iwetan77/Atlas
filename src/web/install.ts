// This is a public download location, never a key or token.
const configured = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();
export const androidApkUrl = configured && /^https:\/\/[^\s]+$/i.test(configured) ? configured : null;
