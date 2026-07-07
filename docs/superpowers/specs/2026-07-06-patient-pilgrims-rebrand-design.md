# Patient Pilgrims rebrand — design

**Date:** 2026-07-06
**Status:** Approved pending review

## Goal

Rebrand "Adulting Catan" to **Patient Pilgrims** (trademark caution around "Catan"),
served at `https://patientpilgrims.stevets.ai/`, without disrupting current deployments
or in-flight games at `https://stevets.ai/adultingcatan/`.

## Constraints & facts

- `stevets.ai` is a GitHub Pages **user site** (repo `TsilenT/tsilent.github.io`) with the
  custom domain; project sites cascade under it, which is why `/adultingcatan` works.
- One custom domain per Pages site. Putting a domain on the `adultingcatan` repo would
  turn `/adultingcatan` into a 301 — rejected for now (that's the eventual cutover lever).
- DNS is at Porkbun, pointed directly at GitHub Pages (no proxy layer available).
- Player identity is Firebase **anonymous auth** → bound to the browser origin. A new
  origin means a new UID; players recover seats via existing claim/recovery links
  (`#/g/{id}/claim/{seat}/{token}`, recoverable from the shared game record).
- Routing is hash-based, so the server never sees game routes; any conditional redirect
  must be client-side.
- The start route also offers **Resume hotseat game** from localStorage — a blanket home
  redirect would strand an in-progress hotseat save on the old origin.

## Design: dual-serve + conditional client redirect, cut over later

### 1. Mirror repo (dual-serve)

- New public repo `TsilenT/patientpilgrims`: deploy target only — no source, no history
  (force-orphan squash pushes). One-line README on its default branch pointing at
  `adultingcatan`.
- Pages serves its `gh-pages` branch; custom domain `patientpilgrims.stevets.ai` via a
  `CNAME` file in the published output.
- `deploy.yml` and `beta.yml` each gain one publish step (e.g. `peaceiris/actions-gh-pages`
  with `external_repository` + deploy key or PAT secret) pushing the **same artifact**
  they already upload to the main site. `/beta` therefore exists on both origins, with the
  same existing caveat (a master push rebuilds without `/beta` until beta re-runs).
- Porkbun: one CNAME record `patientpilgrims → tsilent.github.io`. Enforce HTTPS once the
  cert issues.
- Firebase: add `patientpilgrims.stevets.ai` to Auth authorized domains; if the web API
  key has HTTP-referrer restrictions, add the subdomain there too.
- GitHub account-level domain verification for `stevets.ai` (covers subdomains) if not
  already done.

### 2. Conditional redirect (old origin → subdomain)

Tiny inline script at the top of `index.html`, framework-free, run at boot **and** on
`hashchange`:

Redirect to `https://patientpilgrims.stevets.ai` + `location.pathname` with the leading
`/adultingcatan` stripped (so old `/beta/` lands on new `/beta/`) **only when all hold**:

- `location.hostname === "stevets.ai"` (never fires on the subdomain, localhost, dev)
- hash is empty, `#`, or `#/` — any `#/g/...` game, lobby, or claim link stays on the old
  origin so existing UIDs and seats keep working
- no saved hotseat game in localStorage (key `adultingcatan:game`)

No beta special-casing: old beta URLs redirect path-preserved. The hashchange listener
makes "Back to menu" (win screen, lobby exit, join-error dismiss) the migration moment;
game/claim hashes never trigger it. ErrorBoundary's reload path is covered by the boot
check regardless.

### 3. Rebrand strings (ships to both origins in one build)

- `public/manifest.webmanifest`: `name: "Patient Pilgrims"`, `short_name: "Pilgrims"`.
  Existing installs pick the new name up automatically over time.
- `index.html` `<title>`.
- `<h1>Adulting Catan</h1>` in `StartScreen.tsx` and the resumable branch of `App.tsx`.
- `package.json` name (cosmetic).
- Icons unchanged for now. Repo stays named `adultingcatan` so the old path never breaks.
- localStorage keys (`adultingcatan:game` etc.) stay unchanged — renaming them would
  orphan existing saves for zero user-visible benefit.

### 4. Eventual cutover (separate, later step)

Make the redirect unconditional — or move the custom domain onto the `adultingcatan` repo
for a true 301 — then retire the mirror repo.

## Known side effects (accepted)

- Installed PWAs on the old origin follow the redirect out-of-scope and show a URL bar;
  clean experience requires a one-time reinstall from the subdomain.
- A player who migrates origins mid-game reclaims their seat once via a recovery link.
- Two live origins exist during the transition; new games naturally drain to the new one
  because the home route always redirects.

## Testing

- Unit: redirect predicate extracted where testable, or covered via real-input checks.
- Real input (per project convention): Playwright against a local build — game-hash URLs
  don't redirect, bare URL does, hotseat save pins, hashchange from a win/lobby exit hops.
- Post-deploy smoke: old prod URL redirects, old game link serves, subdomain serves,
  `/beta` on both.
