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
