# Trading: Bank/Port + Async Player Offers (Phase 1c-v)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bank trading at the best available ratio (4:1, 3:1 generic port, 2:1 matching port), plus async player-to-player trade offers (propose / accept / cancel) per spec §6.

**Architecture:** Pure additions to `apply`. `tradeBank` computes the seat's best ratio for the given resource from their port access. Player offers live on `GameState.tradeOffers`; a proposer posts an offer on their turn, any addressed player can accept it later (validated at accept-time — the proposer may have spent the goods), and the proposer can cancel. Offers are cleared at `endTurn`.

**Scope:** Trading only. Reference spec §6 (async offers) and §7 (bank/port trades).

---

## Context (engine on master)
- `src/engine/types.ts`: `GameState`, `Player.resources: ResourceMap`, `BoardState.ports: Port[]` (each `Port { edge: string; vertices: [string,string]; kind: PortKind }`, `PortKind = Resource | "any"`), `BoardState.buildings: Record<vertexId,{owner,type}>`. `Action`, `LogEntry`. `Resource`/`ResourceMap` exported.
- `src/engine/resources.ts`: `RESOURCE_LIST`, `ResourceMap`, `canAfford`, `payInto`, `gainInto`, `emptyResources`, `totalCards`.
- `src/engine/actions/build.ts`: `requireMain` pattern (phase main + subPhase main).
- `src/engine/apply.ts`: `route`; `applyEndTurn` in `actions/turn.ts`.

### Environment
Windows; node/npm/npx on PATH; `npm run test:run`, `npm run typecheck`. Strict tsconfig. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File structure
- Modify `types.ts` — `TradeOffer`, `GameState.tradeOffers` + `GameState.tradeSeq`, `Action` + `LogEntry`.
- Modify `state.ts` — seed `tradeOffers: []`, `tradeSeq: 0`.
- Create `src/engine/actions/trade.ts` — `applyTradeBank`, `applyProposeTrade`, `applyAcceptTrade`, `applyCancelTrade`, and a `portRatio` helper.
- Modify `actions/turn.ts` — clear `tradeOffers` on endTurn.
- Modify `apply.ts` — route the four actions.
- Create `tests/engine/trade.test.ts`.

---

## Task 1: Bank/port trade (`tradeBank`)
- [ ] **types.ts:** `Action` += `| { type: "tradeBank"; give: Resource; get: Resource }`; `LogEntry.type` += `"tradeBank"`.
- [ ] **trade.ts:**
```ts
import type { GameState, Resource } from "../types";
import { RESOURCE_LIST, type ResourceMap } from "../resources";

export function portRatio(state: GameState, seat: number, resource: Resource): number {
  let ratio = 4;
  for (const port of state.board.ports) {
    const owns = port.vertices.some((v) => state.board.buildings[v]?.owner === seat);
    if (!owns) continue;
    if (port.kind === "any") ratio = Math.min(ratio, 3);
    else if (port.kind === resource) ratio = Math.min(ratio, 2);
  }
  return ratio;
}

function requireMain(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  return null;
}

export function applyTradeBank(state: GameState, give: Resource, get: Resource): string | null {
  const err = requireMain(state);
  if (err) return err;
  if (give === get) return "Trade two different resources";
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  const ratio = portRatio(state, seat, give);
  if (player.resources[give] < ratio) return `You need ${ratio} ${give} to trade`;
  if (state.bank[get] < 1) return "The bank is out of that resource";
  player.resources[give] -= ratio;
  state.bank[give] += ratio;
  player.resources[get] += 1;
  state.bank[get] -= 1;
  state.log.push({ type: "tradeBank", seat });
  return null;
}
```
- [ ] **apply.ts:** `case "tradeBank": return applyTradeBank(draft, action.give, action.get);`
- [ ] **Tests** `tests/engine/trade.test.ts`: 4:1 default (no ports); place a generic ("any") port building → 3:1; place a matching specific port → 2:1; reject when short of `ratio`. (Build a `mainGame()` like other engine tests; set `g.board.ports` and a building on a port vertex to control access.)
- [ ] Run → pass; commit `feat(engine): bank/port trading at best ratio`.

## Task 2: Propose a player trade offer
- [ ] **types.ts:** add
```ts
export interface TradeOffer {
  id: number;
  from: number;
  to?: number;          // undefined = open to any opponent
  give: ResourceMap;    // what the proposer gives
  want: ResourceMap;    // what the proposer wants
}
```
add `tradeOffers: TradeOffer[];` and `tradeSeq: number;` to `GameState`; `Action` += `| { type: "proposeTrade"; give: ResourceMap; want: ResourceMap; to?: number }`; `LogEntry.type` += `"proposeTrade"`.
- [ ] **state.ts:** seed `tradeOffers: [], tradeSeq: 0,`.
- [ ] **trade.ts:** `applyProposeTrade` — requireMain; the proposer must currently hold `give`; `give`/`want` must be non-negative and non-empty; push `{ id: state.tradeSeq++, from: seat, give, want, ...(to !== undefined ? {to} : {}) }`.
```ts
import { canAfford } from "../resources";

export function applyProposeTrade(state: GameState, give: ResourceMap, want: ResourceMap, to: number | undefined): string | null {
  const err = requireMain(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  const nonNeg = (m: ResourceMap) => RESOURCE_LIST.every((r) => m[r] >= 0);
  const total = (m: ResourceMap) => RESOURCE_LIST.reduce((s, r) => s + m[r], 0);
  if (!nonNeg(give) || !nonNeg(want)) return "Trade amounts cannot be negative";
  if (total(give) === 0 || total(want) === 0) return "A trade must offer and request something";
  if (!canAfford(state.players[seat]!.resources, give)) return "You do not have what you are offering";
  const offer: TradeOffer = to !== undefined
    ? { id: state.tradeSeq, from: seat, to, give, want }
    : { id: state.tradeSeq, from: seat, give, want };
  state.tradeSeq += 1;
  state.tradeOffers.push(offer);
  state.log.push({ type: "proposeTrade", seat });
  return null;
}
```
(Import `TradeOffer` type into trade.ts.)
- [ ] **apply.ts:** `case "proposeTrade": return applyProposeTrade(draft, action.give, action.want, action.to);`
- [ ] **Tests:** an offer appears in `tradeOffers` with a unique `id`; reject offering resources you don't have; reject empty give/want.
- [ ] Run → pass; commit `feat(engine): propose player trade offer`.

## Task 3: Accept a trade offer
- [ ] **types.ts:** `Action` += `| { type: "acceptTrade"; offerId: number; seat: number }`; `LogEntry.type` += `"acceptTrade"`.
- [ ] **trade.ts:** `applyAcceptTrade(state, offerId, seat)`:
  - find the offer; the accepting `seat` must NOT be the proposer; if `offer.to` is set it must equal `seat`;
  - re-validate: proposer still holds `give`, acceptor holds `want`;
  - transfer: proposer `give` → acceptor, acceptor `want` → proposer (use `payInto`/`gainInto`);
  - remove the offer from `tradeOffers`; log `{type:"acceptTrade", seat}`.
```ts
import { payInto, gainInto } from "../resources";

export function applyAcceptTrade(state: GameState, offerId: number, seat: number): string | null {
  const idx = state.tradeOffers.findIndex((o) => o.id === offerId);
  if (idx === -1) return "That trade offer no longer exists";
  const offer = state.tradeOffers[idx]!;
  if (seat === offer.from) return "You cannot accept your own offer";
  if (offer.to !== undefined && offer.to !== seat) return "That offer is not addressed to you";
  const proposer = state.players[offer.from]!;
  const acceptor = state.players[seat]!;
  if (!canAfford(proposer.resources, offer.give)) return "The proposer can no longer cover the trade";
  if (!canAfford(acceptor.resources, offer.want)) return "You cannot cover the trade";
  payInto(proposer.resources, offer.give); gainInto(acceptor.resources, offer.give);
  payInto(acceptor.resources, offer.want); gainInto(proposer.resources, offer.want);
  state.tradeOffers.splice(idx, 1);
  state.log.push({ type: "acceptTrade", seat });
  return null;
}
```
- [ ] **apply.ts:** `case "acceptTrade": return applyAcceptTrade(draft, action.offerId, action.seat);`
- [ ] **Tests:** a valid accept swaps resources both ways and removes the offer; reject if proposer no longer holds `give` (spent it); reject a targeted offer accepted by the wrong seat; reject accepting your own offer.
- [ ] Run → pass; commit `feat(engine): accept player trade offer`.

## Task 4: Cancel + clear offers on endTurn
- [ ] **types.ts:** `Action` += `| { type: "cancelTrade"; offerId: number }`; `LogEntry.type` += `"cancelTrade"`.
- [ ] **trade.ts:** `applyCancelTrade(state, offerId)` — only the proposer (active seat) may cancel their own offer; remove it.
```ts
export function applyCancelTrade(state: GameState, offerId: number): string | null {
  const idx = state.tradeOffers.findIndex((o) => o.id === offerId);
  if (idx === -1) return "That trade offer no longer exists";
  if (state.tradeOffers[idx]!.from !== state.turn.activeSeat) return "You can only cancel your own offer";
  state.tradeOffers.splice(idx, 1);
  state.log.push({ type: "cancelTrade", seat: state.turn.activeSeat });
  return null;
}
```
- [ ] **apply.ts:** `case "cancelTrade": return applyCancelTrade(draft, action.offerId);`
- [ ] **turn.ts** `applyEndTurn`: add `state.tradeOffers = [];` before advancing the turn (offers don't persist past the proposer's turn).
- [ ] **Tests:** proposer cancels their offer; a non-proposer cannot cancel; endTurn clears all offers.
- [ ] Run full suite + typecheck → green; commit `feat(engine): cancel trade + clear offers on endTurn`.

## Done criteria
- `tradeBank` uses 4:1 / 3:1 / 2:1 based on port access; player offers can be proposed, accepted (re-validated at accept-time), and cancelled; offers clear at `endTurn`.
- Full suite + typecheck green.
