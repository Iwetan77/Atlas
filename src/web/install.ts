// This is a public download location, never a key or token. GitHub sends it to the `atlas.apk` of the
// newest full release, so a new APK needs a new release, not a website rebuild.
const published = 'https://github.com/Iwetan77/Atlas/releases/latest/download/atlas.apk';
const configured = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim() || published;
export const androidApkUrl = configured && /^https:\/\/[^\s]+$/i.test(configured) ? configured : null;
