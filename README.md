# Atlas

**Your money, one balance, anything on-chain.** Atlas is a money app for people whose salary loses value
while it sits in the bank, Nigerians first. Add naira-worth of dollars once, then buy memes, tokenized
stocks and crypto, open perps, explore predictions, earn yield and pay friends, all from one balance shown in your own currency,
with **one tap to confirm** and no chain names, bridges or gas to think about.

- **Engine (API):** [Iwetan77/Atlas-Engine](https://github.com/Iwetan77/Atlas-Engine), live at
  https://justatlas.xyz
- **This repo:** the client. React Native + Expo (managed workflow), TypeScript, one codebase for iOS,
  Android and web.

Money is always shown in the user's currency (₦, $, €, £, KSh, GH₵, R). Under the hood it's USDC on Solana
and Base; chain names only appear on the deposit screen, where sending on the wrong network loses money.

---

## How it works

1. **Sign in** with Google or email. Privy creates the user's own wallets (EVM and Solana) with no seed
   phrase and no "create wallet" step.
2. **Add money** from the Add money sheet:
   - **Wallet or exchange:** USDC on Solana or Base goes straight in; USDT on Tron or BNB Chain, USDC on Sui,
     SOL and 19 more networks and coins get a one-off address (with a QR and live status) and arrive as dollars.
     Each option shows its coin's logo with the chain as a badge. Type what you want to land in your balance;
     the quote adds fees on top and shows the full amount to send.
   - **Bank transfer:** a one-time Nigerian bank account for the exact transfer. Type the amount you want
     in your balance; Fee and delivery costs go on top, with the total shown before you transfer.
3. **Home** shows the one balance (hide it with the eye: amounts turn into `₦••••`), what's earning, and a
   card per coin held with its gain or loss, shareable as an image.
4. **Trade:** Trending (the day's biggest risers, per kind), Crypto, Stocks and Memes, plus search by name or
   pasted address on any supported chain. Every asset has a price chart; a coin nobody has vetted carries an
   **unverified** warning with its address.
5. **Buy or sell in one tap.** The app gets a live quote (price held for a few seconds, refreshed), the user
   confirms once on the confirm sheet, and the app signs the engine's plan and follows it to the end:
   "Getting your money ready…", then "Buying…", then done. If the cash is on another chain, it moves first,
   inside that same confirm.
6. **Perps** on Hyperliquid: crypto, stocks, commodities, indices and currencies, long or short with leverage,
   margin from the balance, liquidation price shown before opening, one tap to close, and the money comes back
   to the balance. Pick take-profit and stop-loss when opening, or edit them on a position later.
7. **Earn:** pick a venue (Jupiter Lend, Morpho, Aave, Jito), then what to save in, best rate first; put in or
   take out any time.
8. **Withdraw** from Home's Withdraw sheet, the mirror of Add money, each screen showing what's spendable on
   a pink card:
   - **Atlas Friends:** to an @handle, straight to the friend's wallet on the chain the cash is on.
   - **Atlas Link:** a link anyone can claim on the web, no app needed.
   - **Send to bank:** naira to any Nigerian bank account. Typing an account number suggests matching
     recent recipients with their bank logo, name and account number; recents refresh on returning.
   - **Withdraw to wallet:** paste any address and pick the coin: USDC on Solana or Base, USDT on Tron or BNB
     Chain, SOL, BTC and other supported deposit coins. The amount entered is what the recipient gets;
     fees go on top, and the review shows the full cash debit and any estimated wallet network fee.
     Availability and minimum amounts come from the live route.
9. **The bottom bar:** Home, Trade, Perps, Atlas Predictions (opens the mini app straight away; it's under More's
   mini apps too) and More. Predictions shows live Polymarket events, fee-inclusive minimum spend, outcome
   shares, resolved winnings and cash return. Returning cash lands the amount entered, with fees added on top.
   The desktop sidebar and Home dashboard also link straight to Predictions and Send money.
10. **Errors speak money:** "Not enough in your balance for this. You have ₦12,400 to spend", with an
   **Add money** button right there.

---

## What's integrated

| | What it does in the app |
|---|---|
| **Expo SDK 57 + Expo Router** | One codebase for iOS, Android and web; file-based routes in `src/app`. |
| **Privy (Expo and React SDKs)** | Google and email sign-in, the user's embedded wallets, headless signing after the one confirm. |
| **Atlas Engine** | Everything with money in it: balance, quotes, plans, deposits, perps, earn, friends. The app sends the Privy access token on every request. |
| **react-native-qrcode-styled** | Deposit QR codes. |
| **EAS** | Cloud builds (APK / iOS) and updates. |

---

## Safety model

- **The app never holds keys or secrets.** Wallets are Privy's embedded wallets, owned by the user; the Privy
  app secret lives only in the engine.
- **One confirm, then only what was confirmed.** The confirm sheet shows the plan in plain words; the app
  signs exactly the engine's plan: transactions, pinned EVM typed data, or one-use Privy device approvals.
  The bridge passes device approvals to Privy; it never signs a user's wallet using their login token.
- **No wallet pop-ups.** Privy's own UIs are off, so the confirm sheet is the only prompt the user answers.
- **Base transactions are relayed, not re-built:** the app hands the planned transaction to the engine,
  which sends it only if it matches the plan byte for byte.
- **Gas is the user's own**, topped up from their USDC when needed; the app never asks Privy to sponsor it.
  Deposits do not automatically collect a Solana gas reserve each time. Swaps first check whether the
  existing SOL can pay their fees and account rent. The gas tank's displayed value uses live SOL and FX prices.
- **Unverified coins say so**, with the address, before any money moves.

---

## Architecture

```mermaid
flowchart LR
  U[User] --> APP[Atlas app<br/>Expo: iOS · Android · web]
  APP -->|sign-in, wallets, signing| PRIVY[Privy]
  APP -->|quote → plan → signed → status| ENGINE[Atlas Engine<br/>Render]
  ENGINE --> VENUES[Jupiter · 1Click · Cetus · Ref · Relay · Hyperliquid · Polymarket · CoW · Morpho · Aave …]
```

```
src/app            Screens (Expo Router): tabs (Home, Trade, Perps, Predictions, More), trade/[assetId],
                   perps/[marketId], predictions/*, earn, deposit, send/*, profile, sign-in, claim/[linkId]
src/api            Engine client and the typed contract (contract.ts); intents.ts runs every action
src/signing        Confirm sheet, signers (native and web), chain helpers
src/auth           Privy provider (native and web), session state
src/funding        The Add money sheet
src/components     Home cards, trade, perps, send, share cards, UI kit (SelectSheet, PillButton…)
src/format         Money, currency list and flags
```

**Every action in one breath:** `getPlan()` (quote → execute) → the confirm sheet → sign or send each
transaction → `POST /v1/intents/{id}/signed` → poll `GET /v1/intents/{id}`; when the engine says the second
step is ready (cash or gas landed), `GET /next`, sign, report, and keep polling until filled or failed
(`src/api/intents.ts`). If the app closes before a later signature, Home's pending-purchase card
lets the user finish from their own wallet without paying for the purchase again. Activity shows the
last six actions on Home, with the full history, statuses and transaction IDs under See more.
Money emails go to the sign-in address; Profile can turn them off.

---

## Run it locally

You need Node 22+ (the app is built with Node 25).

```bash
npm install
cp .env.example .env        # EXPO_PUBLIC_ENGINE_URL (and optionally EXPO_PUBLIC_PRIVY_CLIENT_ID)
npx expo start              # web, or a development build on a phone
npx expo export -p web      # static web build in dist/
```

The app uses native modules beyond Expo Go, so on a phone use a development build
(`npx eas-cli@latest build --profile development`) and `npx expo start`.

Before every commit:

```bash
npx tsc --noEmit
npx expo lint
```

## Build

```bash
npx eas-cli@latest build -p android --profile preview      # installable APK
npx eas-cli@latest build -p ios --profile preview          # needs an Apple Developer account
```

Every profile in `eas.json` points at the live engine (`EXPO_PUBLIC_ENGINE_URL`). Mainnet only.

---

## What's been verified

| Check | Status |
|---|---|
| Sign-in, wallets, balance and holdings against the live engine | ✅ web and phone |
| Trade lists, search, charts, quotes and the unverified warning | ✅ live engine |
| Confirm sheet → sign → settle, two-step plans (cash or gas first), stalls and retries | ✅ against a stand-in engine that follows `contract.ts` |
| Deposit list (featured + More networks and coins), QR and status, Back to the Add money list | ✅ web |
| Earn venues and markets (incl. Morpho's vaults), hidden balance, currency picker | ✅ web |
| Complete funded coverage across every venue and route | Not established by unit tests or unsigned dry runs; verify each funded path separately |


## Desktop website and phone installation

Laptop/desktop browsers (at least 1024px wide, excluding iPhone/iPad/Android user agents) use an Atlas pink/slate website: public welcome and Google/email sign-in, sidebar navigation, a two-column Home dashboard with a Predictions shortcut, asset cards, market/order panels, Send/More grids and centred approval/funding dialogs. These reuse the same real account, balance, quotes, history and signing flows. Native and narrow mobile web retain the phone layout; mobile web adds a small installation link. Private browser session/wallet components mount after hydration so a server snapshot cannot reset sign-in.

`/install` is public. iPhone shows original Atlas illustrations and Safari Share -> Add to Home Screen instructions. It installs the website as a web app, not an iOS native binary. The public web manifest and existing Atlas icon provide the standalone name/icon. No service worker caches balances, login tokens or signed requests.

Android downloads the latest signed APK from GitHub Releases. `EXPO_PUBLIC_ANDROID_APK_URL` can override that public link; it is not a secret. Keep the same EAS signing credentials so an update installs over the previous app. Desktop's Get Atlas link opens the same platform guide. The install strip hides in standalone mode.

Build/check: `npx tsc --noEmit`, `npx expo lint`, `npx expo export -p web`, `git diff --check`. The production website is served by the engine at `https://justatlas.xyz`; set both `EXPO_PUBLIC_ENGINE_URL` and `EXPO_PUBLIC_WEB_URL` to that origin for the web export. Copy the production export into the engine's `crates/engine-service/web/` for Render (never copy local QA fixtures). When hosting at a new domain, allow that exact origin in the engine's `ATLAS_ALLOWED_ORIGINS` and in Privy's allowed web origins; the backend URL is public but authentication remains required. There is no test auth bypass in this implementation.

### Current Android download
The website's Android button downloads [the newest Atlas APK](https://github.com/Iwetan77/Atlas/releases/latest/download/atlas.apk): GitHub sends that link to
the `atlas.apk` file of the newest full (not pre-) release, so publishing an update needs no website rebuild.
EXPO_PUBLIC_ANDROID_APK_URL can override it.

To publish an update: build with `npx eas-cli@latest build -p android --profile preview` (the existing EAS
signing credentials, so phones update over the installed app; EAS raises the build number), then make a
GitHub release `v<version>` (not a pre-release) with the APK attached as `atlas.apk`.

## Payment PIN and share cards

After sign-in, every account sets a four-digit payment PIN; new accounts choose their handle in the
same setup. Reviews keep the amount, recipient and fee visible and ask for the PIN instead of another
Confirm button. One approval covers the saved payment's later steps. Profile → Payment PIN changes
it using the current PIN. PINs and payment approvals are never stored in AsyncStorage or logs.

The engine checks the PIN and limits wrong attempts in persistent storage. Older clients are stopped
before receiving a spending plan and must update. A forgotten PIN cannot be overwritten from a
normal login: account recovery needs a separately verified process before a reset is added.

Share on a position or coin card opens an image preview with Download image and, when supported,
Share image. Web captures only the card, with bounded image loading and capture time; the system
share call follows a fresh tap so Safari permits it. Android Download image saves the PNG to Pictures;
iPhone browsers download the PNG. Bank logos are bundled for common Nigerian banks,
including OPay and MoMo, so they do not depend on a remote logo service.

### Bank payout progress and Android wallet recovery

A signed bank transfer opens a live progress screen. Funding the payout address does not mean the
bank has been paid: success follows the receipt's confirmed payout state. Receipt details poll while
visible and stop after settlement; Activity's refresh cannot delay a receipt's own refresh. Solana
cash normally travels through Relay to a Base payout address to avoid a fresh Solana USDC account's
rent; a direct Solana payout remains the fallback. This reduces fees, but adds a funding step.

Android reconnects an existing Privy Solana wallet after a startup transport error, with bounded,
single-flight retries. It never retries a purchase as part of reconnecting. Funded steps use the
current wallet after PIN approval, and completed transaction reports remain tied to the original
user. Unsigned drafts display **Awaiting confirmation**, rather than **On its way**.

**Download image** saves native Android share cards as PNGs in Pictures. Android 11 and later use
scoped storage without requesting access to existing photos; older Android versions request write
access when saving. Profile shows the installed Android version and build number. Native changes
require rebuilding and installing the APK; a website deployment does not update an installed app.

Run `node --test scripts/test-wallet-reconnect.mjs scripts/test-bank-and-image-save.mjs` for the
wallet, action-reporting, bank-state and native-save regressions (mocked SDK/system boundaries).
