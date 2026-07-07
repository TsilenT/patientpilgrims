# Deploying Patient Pilgrims

The app is a static Vite build hosted on GitHub Pages. Game state lives in Firebase
Realtime Database; security is enforced by `database.rules.json`. The rules engine and UI
never trust the client beyond what the rules allow (trust-the-friends model — see the
[design spec](superpowers/specs/2026-06-03-catan-async-design.md)).

## One-time setup

1. **Firebase project** — create a free project. Enable:
   - **Realtime Database** (Build → Realtime Database → Create Database, locked mode).
   - **Anonymous** sign-in (Build → Authentication → Sign-in method → Anonymous).
2. **Web config** — Project settings → Your apps → web app. Put the values in:
   - local `.env` (copy from `.env.example`), and
   - GitHub → repo Settings → Secrets and variables → Actions → add each `VITE_FIREBASE_*`
     as a repository secret (names match `.env.example`).
3. **Deploy security rules** — requires Node + a JDK 21+ for the emulator tooling:
   ```bash
   npx firebase login
   npm run rules:deploy   # firebase deploy --only database
   ```
4. **Enable Pages** — repo Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Deploy

Push to `master`. The workflow (`.github/workflows/deploy.yml`):
1. **test** — typecheck, unit tests, and the Firebase **emulator** suites (rules + adapter)
   on JDK 21.
2. **build** — `npm run build` with the `VITE_FIREBASE_*` secrets injected.
3. **deploy** — publishes `dist/` to Pages.

`vite.config.ts` uses `base: "./"` (relative), so the project URL
(`<user>.github.io/adultingcatan/`) works without further configuration.

## Dual origins (rebrand transition)

The same build serves at two origins:

- `https://patientpilgrims.stevets.ai/` — canonical. A mirror step in both workflows
  pushes the built site to `TsilenT/patientpilgrims` (`gh-pages` branch, force-orphan),
  whose Pages site owns the subdomain (`MIRROR_DEPLOY_KEY` secret = deploy key).
- `https://stevets.ai/adultingcatan/` — legacy. `src/app/legacyRedirect.ts` hops home
  routes to the subdomain; game/claim hashes and hotseat saves stay put so
  origin-bound anonymous-auth seats keep working. Cutover later = make the redirect
  unconditional (or move the custom domain onto this repo for a true 301), then
  retire the mirror.

## Local development

```bash
cp .env.example .env   # fill in your Firebase web config
npm run dev
```

Without a `.env`, the app runs **hotseat-only** (the "New online game" button is hidden) —
so you can develop and run the full unit suite with no Firebase at all.

## Running the emulator tests locally

Requires **JDK 21+** and `firebase-tools` (a devDependency, installed by `npm ci`):

```bash
npm run test:emulator   # firebase emulators:exec --only database,auth "vitest run tests/net"
```

These cover the security rules and the transactional adapter. They are excluded from the
default `npm run test:run` gate (which needs no Java) and run in CI on every push.
