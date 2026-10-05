// This is a public download location, never a key or token. GitHub sends it to the `atlas.apk` of the
// newest full release, so a new APK needs a new release, not a website rebuild.
const published = 'https://github.com/Iwetan77/Atlas/releases/latest/download/atlas.apk';
// An override may point somewhere else entirely, but never at one fixed Atlas release: a pinned link
// goes stale (the website once handed out 1.0.1-beta.2, which talked to a retired server).
const pinned = /github\.com\/Iwetan77\/Atlas\/releases\/download\//i;
const override = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();
const configured = override && !pinned.test(override) ? override : published;
export const androidApkUrl = /^https:\/\/[^\s]+$/i.test(configured) ? configured : null;
