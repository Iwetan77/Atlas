# Atlas

One balance, in your own currency. Fund it, spend it on anything (spot, memes, tokenized stocks, perps, yield) and cash out, without ever seeing a chain name, a bridge, or more than one signature per action.

This repo is the client: React Native + Expo (managed workflow), TypeScript, one codebase for iOS, Android and Web. Chain logic, swap routing and signing policy live in the engine: [Atlas-Engine](https://github.com/Iwetan77/Atlas-Engine).

## Run it

```bash
npm install
npx expo start          # scan the QR with Expo Go on your phone
npx expo export -p web  # static web build in dist/
```

## Android build (EAS cloud)

```bash
npx eas-cli@latest build -p android --profile preview
```

Produces a downloadable `.apk`. iOS uses the same workflow once an Apple Developer account is attached.
