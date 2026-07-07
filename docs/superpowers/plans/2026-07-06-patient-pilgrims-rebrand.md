# Patient Pilgrims Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app to "Patient Pilgrims", dual-serve it at `patientpilgrims.stevets.ai` via a mirror repo, and conditionally redirect the old origin's home route there — per `docs/superpowers/specs/2026-07-06-patient-pilgrims-rebrand-design.md`.

**Architecture:** Brand strings change in manifest/title/headings (storage keys untouched). A small module `src/app/legacyRedirect.ts` — a pure, unit-tested predicate plus a boot/hashchange installer called first in `main.tsx` — hops `stevets.ai` visitors to the subdomain unless they're on a game/claim hash or have a hotseat save. Both deploy workflows additionally push their built artifact to a new `TsilenT/patientpilgrims` repo whose Pages site owns the subdomain.

**Tech Stack:** Vite + React + TypeScript, Vitest (jsdom), GitHub Actions + `peaceiris/actions-gh-pages`, GitHub Pages, Porkbun DNS, Firebase anonymous auth.

**Note on spec wording:** The spec says "inline script in index.html". We implement it as a module imported first by `main.tsx` instead — single source of truth, unit-testable, and the page shows nothing before the bundle anyway (empty `#root`). Task 6 amends the spec line.

---

### Task 1: Branch setup

The spec/plan commits live on `turn-actions`; feature work branches off `master`.

**Files:** none (git only)

- [ ] **Step 1: Create the branch off master and bring the docs over**

```bash
cd /home/stevets/projects/adultingcatan
git checkout master && git pull
git checkout -b patient-pilgrims
git checkout turn-actions -- docs/superpowers/specs/2026-07-06-patient-pilgrims-rebrand-design.md docs/superpowers/plans/2026-07-06-patient-pilgrims-rebrand.md
git add docs/superpowers && git commit -m "Add Patient Pilgrims rebrand spec and plan

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

- [ ] **Step 2: Verify clean baseline**

Run: `npm run test:run`
Expected: all tests pass (emulator suite excluded by default — that's fine).

---

### Task 2: Rebrand strings

**Files:**
- Modify: `public/manifest.webmanifest`
- Modify: `index.html:12`
- Modify: `src/app/StartScreen.tsx:32`
- Modify: `src/app/App.tsx:133`
- Modify: `package.json:2`
- Test: `tests/ui/app.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/app.test.tsx` (it already renders `<App />` with jsdom and clears localStorage in `beforeEach`):

```tsx
test("start screen shows the Patient Pilgrims brand", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Patient Pilgrims" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/app.test.tsx -t "Patient Pilgrims"`
Expected: FAIL — heading found is "Adulting Catan".

- [ ] **Step 3: Change the brand strings**

`public/manifest.webmanifest` — replace the two name fields:

```json
{
  "name": "Patient Pilgrims",
  "short_name": "Pilgrims",
```

`index.html` line 12:

```html
    <title>Patient Pilgrims</title>
```

`src/app/StartScreen.tsx` line 32 and `src/app/App.tsx` line 133 (the resumable branch) — both:

```tsx
      <h1>Patient Pilgrims</h1>
```

`package.json` line 2:

```json
  "name": "patient-pilgrims",
```

Then sync the lockfile — `npm ci` in CI errors if the two `name` fields disagree:

```bash
npm install --package-lock-only
```

Do **not** touch any `adultingcatan:*` localStorage keys (`persistence.ts`, `Lobby.tsx`, `GameView.tsx`, `net/lobby.ts`) — renaming them would orphan existing saves.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/app.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest index.html src/app/StartScreen.tsx src/app/App.tsx package.json package-lock.json tests/ui/app.test.tsx
git commit -m "Rebrand to Patient Pilgrims (manifest, title, headings)

Storage keys keep the adultingcatan: prefix so existing saves survive.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

---

### Task 3: Export the hotseat save key

The redirect module needs the localStorage key that `persistence.ts` keeps private.

**Files:**
- Modify: `src/state/persistence.ts:9`

- [ ] **Step 1: Export the key**

In `src/state/persistence.ts`, change line 9 from:

```ts
const KEY = "adultingcatan:game";
```

to:

```ts
/** localStorage key for the hotseat save. Exported for the legacy-origin redirect guard. */
export const HOTSEAT_SAVE_KEY = "adultingcatan:game";
```

and update the three internal uses (`getItem(KEY)`, `setItem(KEY, …)`, `removeItem(KEY)`) to `HOTSEAT_SAVE_KEY`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx vitest run tests/ui/persistence.test.ts tests/ui/winscreen.test.tsx`
Expected: PASS (those tests hardcode the string key, which is exactly why it must not change).

- [ ] **Step 3: Commit**

```bash
git add src/state/persistence.ts
git commit -m "Export the hotseat save key from persistence

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

---

### Task 4: Legacy-origin redirect module

**Files:**
- Create: `src/app/legacyRedirect.ts`
- Modify: `src/main.tsx`
- Test: `tests/app/legacyRedirect.test.ts`

- [ ] **Step 1: Write failing tests for the pure predicate**

Create `tests/app/legacyRedirect.test.ts`:

```ts
// @vitest-environment jsdom
import { test, expect, beforeEach } from "vitest";
import { legacyRedirectTarget, installLegacyRedirect } from "../../src/app/legacyRedirect";
import { HOTSEAT_SAVE_KEY } from "../../src/state/persistence";

const OLD = (pathname: string, hash: string) => ({ hostname: "stevets.ai", pathname, hash });

test("bare production URL redirects to the subdomain root", () => {
  expect(legacyRedirectTarget(OLD("/adultingcatan/", ""), false))
    .toBe("https://patientpilgrims.stevets.ai/");
});

test("empty-route hashes ('#', '#/') still redirect", () => {
  expect(legacyRedirectTarget(OLD("/adultingcatan/", "#"), false)).not.toBeNull();
  expect(legacyRedirectTarget(OLD("/adultingcatan/", "#/"), false)).not.toBeNull();
});

test("beta path redirects path-preserved", () => {
  expect(legacyRedirectTarget(OLD("/adultingcatan/beta/", ""), false))
    .toBe("https://patientpilgrims.stevets.ai/beta/");
});

test("game and claim hashes never redirect", () => {
  expect(legacyRedirectTarget(OLD("/adultingcatan/", "#/g/abc123"), false)).toBeNull();
  expect(legacyRedirectTarget(OLD("/adultingcatan/", "#/g/abc123/claim/2/tok"), false)).toBeNull();
});

test("a saved hotseat game pins the old origin", () => {
  expect(legacyRedirectTarget(OLD("/adultingcatan/", ""), true)).toBeNull();
});

test("only fires on stevets.ai", () => {
  expect(legacyRedirectTarget({ hostname: "patientpilgrims.stevets.ai", pathname: "/", hash: "" }, false)).toBeNull();
  expect(legacyRedirectTarget({ hostname: "localhost", pathname: "/", hash: "" }, false)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/legacyRedirect.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the module**

Create `src/app/legacyRedirect.ts`:

```ts
import { HOTSEAT_SAVE_KEY } from "../state/persistence";

const NEW_ORIGIN = "https://patientpilgrims.stevets.ai";
const LEGACY_HOST = "stevets.ai";

type Loc = { hostname: string; pathname: string; hash: string };

/**
 * Where a legacy-origin visit should hop to, or null to stay.
 * Stays put for game/claim/lobby hashes (anonymous-auth UIDs are origin-bound;
 * in-flight seats must keep working) and for a saved hotseat game.
 */
export function legacyRedirectTarget(loc: Loc, hasHotseatSave: boolean): string | null {
  if (loc.hostname !== LEGACY_HOST) return null;
  if (loc.hash !== "" && loc.hash !== "#" && loc.hash !== "#/") return null;
  if (hasHotseatSave) return null;
  return NEW_ORIGIN + loc.pathname.replace(/^\/adultingcatan/, "");
}

/** Checks at boot and on every hashchange ("Back to menu" is the migration moment). */
export function installLegacyRedirect(
  loc: Loc & { replace(url: string): void } = window.location,
  listen: (fn: () => void) => void = (fn) => window.addEventListener("hashchange", fn),
): void {
  const check = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(HOTSEAT_SAVE_KEY); } catch { /* private mode */ }
    const target = legacyRedirectTarget(loc, saved !== null);
    if (target !== null) loc.replace(target);
  };
  check();
  listen(check);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/legacyRedirect.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for the installer wiring**

Append to `tests/app/legacyRedirect.test.ts`:

```ts
function fakeLoc(hash: string) {
  const replaced: string[] = [];
  return {
    loc: { hostname: "stevets.ai", pathname: "/adultingcatan/", hash, replace: (u: string) => replaced.push(u) },
    replaced,
  };
}

beforeEach(() => localStorage.clear());

test("install redirects at boot on a bare URL", () => {
  const { loc, replaced } = fakeLoc("");
  installLegacyRedirect(loc, () => {});
  expect(replaced).toEqual(["https://patientpilgrims.stevets.ai/"]);
});

test("install stays in a game at boot, then hops when the hash goes home", () => {
  const { loc, replaced } = fakeLoc("#/g/abc123");
  let onHash = () => {};
  installLegacyRedirect(loc, (fn) => { onHash = fn; });
  expect(replaced).toEqual([]);
  loc.hash = "#/";
  onHash();
  expect(replaced).toEqual(["https://patientpilgrims.stevets.ai/"]);
});

test("install respects a hotseat save", () => {
  localStorage.setItem(HOTSEAT_SAVE_KEY, "{}");
  const { loc, replaced } = fakeLoc("");
  installLegacyRedirect(loc, () => {});
  expect(replaced).toEqual([]);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/app/legacyRedirect.test.ts`
Expected: PASS (implementation from Step 3 already covers the wiring; if any fail, fix the module, not the tests).

- [ ] **Step 7: Wire into main.tsx**

In `src/main.tsx`, add after the existing imports (before the gesture-suppression loop):

```ts
import { installLegacyRedirect } from "./app/legacyRedirect";

// Legacy-origin hop: stevets.ai/adultingcatan home routes move to the new brand
// origin. Game/claim hashes and saved hotseat games stay (origin-bound identity).
installLegacyRedirect();
```

- [ ] **Step 8: Full verification**

Run: `npm run test:run && npm run typecheck`
Expected: all pass. (`window.location.replace` never fires under jsdom tests: hostname is `localhost`.)

- [ ] **Step 9: Commit**

```bash
git add src/app/legacyRedirect.ts src/main.tsx tests/app/legacyRedirect.test.ts
git commit -m "Redirect legacy-origin home routes to patientpilgrims.stevets.ai

Boot + hashchange; game/claim hashes and hotseat saves stay on the old
origin so anonymous-auth seats keep working.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

---

### Task 5: Mirror publishing in both workflows

**Files:**
- Modify: `.github/workflows/deploy.yml` (build job, after `upload-pages-artifact`)
- Modify: `.github/workflows/beta.yml` (build job, after `upload-pages-artifact`)

- [ ] **Step 1: Add the mirror step to deploy.yml**

At the end of the `build` job's steps (after the `actions/upload-pages-artifact` step):

```yaml
      # Dual-serve during the rebrand transition: same build, second origin.
      - name: Mirror to patientpilgrims.stevets.ai
        uses: peaceiris/actions-gh-pages@v4
        with:
          deploy_key: ${{ secrets.MIRROR_DEPLOY_KEY }}
          external_repository: TsilenT/patientpilgrims
          publish_branch: gh-pages
          publish_dir: dist
          cname: patientpilgrims.stevets.ai
          force_orphan: true
```

- [ ] **Step 2: Add the same step to beta.yml**

At the end of its `build` job's steps (after `actions/upload-pages-artifact`) — note `publish_dir: site`, the directory holding root + `/beta`:

```yaml
      # Dual-serve during the rebrand transition: same build, second origin.
      - name: Mirror to patientpilgrims.stevets.ai
        uses: peaceiris/actions-gh-pages@v4
        with:
          deploy_key: ${{ secrets.MIRROR_DEPLOY_KEY }}
          external_repository: TsilenT/patientpilgrims
          publish_branch: gh-pages
          publish_dir: site
          cname: patientpilgrims.stevets.ai
          force_orphan: true
```

The existing caveat mirrors too: a master push wipes `/beta` on both origins until this workflow re-runs.

- [ ] **Step 3: Validate the YAML**

Run: `python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ['.github/workflows/deploy.yml','.github/workflows/beta.yml']]; print('ok')"`
Expected: `ok`. (If PyYAML is missing: `npx --yes yaml-lint .github/workflows/*.yml`.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/beta.yml
git commit -m "Mirror deploys to the patientpilgrims repo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

---

### Task 6: Docs

**Files:**
- Modify: `docs/DEPLOY.md`
- Modify: `docs/superpowers/specs/2026-07-06-patient-pilgrims-rebrand-design.md`

- [ ] **Step 1: Update DEPLOY.md**

Line 1 title → `# Deploying Patient Pilgrims`. After the "Deploy" section, add:

```markdown
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
```

- [ ] **Step 2: Amend the spec's "inline script" wording**

In `docs/superpowers/specs/2026-07-06-patient-pilgrims-rebrand-design.md`, replace:

```
Tiny inline script at the top of `index.html`, framework-free, run at boot **and** on
`hashchange`:
```

with:

```
Small module (`src/app/legacyRedirect.ts`) imported first by `main.tsx`, run at boot
**and** on `hashchange` (module instead of an inline script: one testable source of
truth, and nothing renders before the bundle anyway):
```

Also replace the spec's Testing section's second bullet:

```
- Real input (per project convention): Playwright against a local build — game-hash URLs
  don't redirect, bare URL does, hotseat save pins, hashchange from a win/lobby exit hops.
```

with:

```
- Wiring covered by unit tests with an injected location (the hostname guard makes local
  real-input testing moot — it never fires off stevets.ai); real-browser checks happen
  post-deploy against both origins instead.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOY.md docs/superpowers/specs/2026-07-06-patient-pilgrims-rebrand-design.md
git commit -m "Document the dual-origin deploy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RApmxyaqwbqPU6njxpHcsE"
```

---

### Task 7: Infrastructure (mirror repo, key, DNS, Firebase)

Must complete before the branch merges to master, or the mirror step fails the deploy workflow.

**Files:** none (gh CLI + consoles). Steps 3–4 are **user actions** — surface them, don't skip them.

- [ ] **Step 1: Create the mirror repo and deploy key**

```bash
gh repo create TsilenT/patientpilgrims --public --add-readme \
  --description "Deploy mirror for TsilenT/adultingcatan (Patient Pilgrims)"
KEYDIR=$(mktemp -d) && ssh-keygen -t ed25519 -N "" -C "adultingcatan mirror deploy" -f "$KEYDIR/key"
gh repo deploy-key add "$KEYDIR/key.pub" -R TsilenT/patientpilgrims --allow-write --title "adultingcatan mirror deploy"
gh secret set MIRROR_DEPLOY_KEY -R TsilenT/adultingcatan < "$KEYDIR/key"
rm -rf "$KEYDIR"
```

Expected: repo URL printed; deploy key added; secret set. Verify: `gh secret list -R TsilenT/adultingcatan | grep MIRROR_DEPLOY_KEY`.

- [ ] **Step 2: Give the mirror's default branch a pointer README**

```bash
printf '# patientpilgrims\n\nDeploy mirror for [TsilenT/adultingcatan](https://github.com/TsilenT/adultingcatan) — do not edit; every deploy force-pushes gh-pages.\n' > /tmp/claude-1000/-home-stevets-projects-adultingcatan/3718a942-6563-4eb2-a594-134f9e417583/scratchpad/README.md
gh api -X PUT repos/TsilenT/patientpilgrims/contents/README.md \
  -f message="Point at the source repo" \
  -f content="$(base64 -w0 /tmp/claude-1000/-home-stevets-projects-adultingcatan/3718a942-6563-4eb2-a594-134f9e417583/scratchpad/README.md)" \
  -f sha="$(gh api repos/TsilenT/patientpilgrims/contents/README.md --jq .sha)"
```

- [ ] **Step 3 (USER): Porkbun DNS**

Add one record on `stevets.ai`: type **CNAME**, host `patientpilgrims`, answer `tsilent.github.io` (TTL default). Verify from WSL:

```bash
python3 -c "import json,urllib.request; print(json.load(urllib.request.urlopen('https://dns.google/resolve?name=patientpilgrims.stevets.ai&type=A')).get('Answer'))"
```

Expected: the four `185.199.x.153` GitHub Pages IPs (via the CNAME).

- [ ] **Step 4 (USER): Firebase authorized domain**

Firebase console → Authentication → Settings → Authorized domains → add `patientpilgrims.stevets.ai`. Also check Google Cloud console → APIs & Services → Credentials → the browser API key: if it has HTTP-referrer restrictions, add `https://patientpilgrims.stevets.ai/*`; if unrestricted, nothing to do.

---

### Task 8: Deploy, enable Pages on the mirror, smoke test

Requires Tasks 1–7 complete and the user's go-ahead to merge (use superpowers:finishing-a-development-branch for the merge decision).

- [ ] **Step 1: Merge to master and push** (per user's chosen integration path)

The push runs `deploy.yml`: old origin updates AND the first mirror push creates `gh-pages` in the mirror repo. Watch: `gh run watch -R TsilenT/adultingcatan` (or `gh run list -R TsilenT/adultingcatan --limit 1`).

- [ ] **Step 2: Enable Pages on the mirror (first deploy only)**

```bash
gh api -X POST repos/TsilenT/patientpilgrims/pages -f build_type=legacy -f "source[branch]=gh-pages" -f "source[path]=/"
```

The `CNAME` file in the branch sets the custom domain automatically. Once the cert issues (minutes–hours):

```bash
gh api repos/TsilenT/patientpilgrims/pages --jq '{cname, https_enforced, status}'
gh api -X PUT repos/TsilenT/patientpilgrims/pages -F https_enforced=true
```

- [ ] **Step 3: Smoke test**

```bash
curl -sI https://patientpilgrims.stevets.ai/ | head -3          # 200, server: GitHub.com
curl -s  https://patientpilgrims.stevets.ai/manifest.webmanifest | grep Pilgrims
curl -sI https://stevets.ai/adultingcatan/ | head -3             # still 200 (redirect is client-side JS)
```

Then real-browser checks (WSL screenshot workflow — Windows Chrome one-shot headless):
- `https://stevets.ai/adultingcatan/` → lands on `https://patientpilgrims.stevets.ai/` showing the Patient Pilgrims start screen.
- `https://stevets.ai/adultingcatan/#/g/nosuchgame` → **stays** on the old origin ("Game not found" / couldn't join — no redirect).
- `https://patientpilgrims.stevets.ai/` → start screen, no redirect loop.

Deliver the screenshots to the user (per working style: screenshots, not questions).

- [ ] **Step 4: Re-run the beta workflow** (a master push wiped `/beta`)

```bash
gh workflow run beta.yml -R TsilenT/adultingcatan
```

Then verify `https://patientpilgrims.stevets.ai/beta/` serves.

- [ ] **Step 5 (later, USER decides): domain verification**

GitHub → Settings → Pages → Add verified domain `stevets.ai` (TXT record at Porkbun) — protects all subdomains from takeover. Optional but recommended; not blocking.
