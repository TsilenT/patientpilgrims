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
(`<user>.github.io/patientpilgrims/`) works without further configuration.

## Canonical origin

The single canonical origin is `https://patientpilgrims.stevets.ai/`, served directly
by this repository's GitHub Pages deployment. In repo Settings → Pages, keep Source set
to **GitHub Actions** (`build_type: workflow`) and set the custom domain to
`patientpilgrims.stevets.ai`.

After the repository rename and Pages cutover are complete, the `MIRROR_DEPLOY_KEY`
repository secret and the former mirror repository can be deleted; neither is used by
the deployment workflow.

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
