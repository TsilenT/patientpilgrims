# Async Settlers of Catan — Design Spec

**Date:** 2026-06-03
**Status:** Approved (pre-implementation)

A statically-hosted, base-game implementation of Settlers of Catan for a small group
of friends. Async (play-by-turn) rather than real-time. No game server: the rules run
in the browser and state lives in a free hosted database.

---

## 1. Goals & constraints

- **Base game only.** Standard 3–4 player Catan. No expansions.
- **Async play-by-turn.** Players are not necessarily online at the same time. They
  open a link, take their turn, and leave. No real-time presence required.
- **Static hosting.** Deployable to GitHub Pages. No backend server to write, deploy,
  or maintain.
- **Small scale.** ~1–2 concurrent games among trusted friends. No need to scale.
- **Trust-the-friends security model.** Casual impersonation is prevented; a determined
  friend hacking their own browser is explicitly out of scope to defend against.

### Non-goals (YAGNI)

Expansions (Seafarers, Cities & Knights), 5–6 player extension, AI bots, in-app chat,
spectator mode, stats/ELO/ranking, user accounts/profiles, native mobile apps. Discord
turn-notifications are noted as a plausible future add, not built now.

---

## 2. Key product decisions

| Decision | Choice |
|---|---|
| Play model | Async, play-by-turn |
| Player-to-player trading | **Async trade offers**: post an offer on your turn; others accept/decline when they next open the game |
| Identity | **Secret link per seat** — no login, no accounts |
| Rules authority | **Client-authoritative** — the browser computes the next state (trust friends) |
| State storage | **Firebase Realtime Database** — one JSON game-state blob per game |
| Turn nudges | In-app "it's your turn" indicator only |
| Art direction | colonists.io style — flat-ish hexes, ocean background, bold resource icons, white pip discs |
| Layout | Opponents top, board center, hand + actions bottom, log/trades right rail; reflow to bottom-sheet + tabs on phone |
| Toolchain | Node + Vite + TypeScript + Vitest; React for the view layer |
| Deployment | Vite build → GitHub Actions → GitHub Pages |

---

## 3. Architecture

Four isolated layers, depended on top-to-bottom:

```
App / Lobby (React)    create game · claim seat · routing
UI / View (React+SVG)  render state · capture user intent
Net adapter            Firebase RTDB sync · anonymous auth · transactions
Rules engine (pure TS) apply(state, action, rng) -> state    ← fully tested, no I/O
Board geometry (pure)  hexes · vertices · edges · adjacency
```

**Data flow for a move:**

1. UI dispatches an **action** (e.g. `{type:'buildRoad', edge}`).
2. Net adapter runs a Firebase **transaction** on `/games/{id}/state`: read current
   state → `engine.apply(state, action, rng)` → write back with `version + 1`.
3. Firebase pushes the new state to every subscribed client.
4. React re-renders from the new state.

The engine never imports React or Firebase. The UI never computes rules. This is what
makes the engine testable in isolation and the network layer thin.

### Module breakdown

- **`engine/`** — pure, serializable `GameState` + `apply(state, action, rng)`. Owns
  every rule. Pure function; randomness is injected, not global.
- **`board/`** — hex/vertex/edge coordinate system, adjacency queries, random + beginner
  board generation, standard port placement.
- **`net/`** — Firebase wrapper: `subscribeGame(id, cb)`, `commitAction(id, action)`
  (transactional, version-checked), anonymous-auth bootstrap, seat claiming.
- **`ui/`** — React components: SVG board, opponent badges, hand, action bar, log/trade
  rail; converts clicks into engine actions. Desktop + responsive phone layout.
- **`app/`** — create-game flow, secret-link generation, claim-seat flow, hash routing.

---

## 4. Game state model

A single serializable object, stored verbatim in Firebase:

- `version: number` — increments on every applied action (concurrency control).
- `phase: 'setup' | 'main' | 'finished'`.
- `turn`: `{ activeSeat, subPhase, hasRolled, dice?, devCardPlayedThisTurn }`.
  - `subPhase`: `awaitingRoll | main | awaitingRobberMove | awaitingSteal | ...`.
- `board`: `{ hexes[{id, resource, number, coord}], robberHex, ports[{edge,type}],
  vertices{[id]:{owner,type:'settlement'|'city'}}, edges{[id]:{owner}} }`.
- `players[]`: `{ seat, name, color, resources{wood,brick,sheep,wheat,ore},
  devCards[{id,type,boughtTurn,played}], knightsPlayed, victoryPoints,
  longestRoadLength }`.
- `bank`: `{ resources, devDeck: cardId[] }` (deck pre-shuffled at game start).
- `awards`: `{ longestRoad?: seat, largestArmy?: seat }`.
- `discardObligations`: `{ [seat]: count }` — pending 7-discards.
- `tradeOffers[]`: `{ id, fromSeat, give, want, toSeat?: seat|null, status }`.
- `log[]`: append-only event records (also drives the on-screen game log).
- `winner?: seat`.

### Randomness

`apply(state, action, rng)` takes an **injected RNG**. Tests pass a seeded/deterministic
RNG; production passes a crypto-backed one. Results (dice values, drawn dev cards, stolen
card) are recorded in state, but RNG internals are **not** stored — so future dice can't
be predicted from the public state. This keeps the engine pure, replayable in tests, and
free of randomness leaks.

---

## 5. Firebase data model & identity

```
/games/{id}/state          ← public; anyone with the id can read & subscribe
/games/{id}/seats/{i}/uid   ← which device (auth uid) owns seat i
/games/{id}/_claims/{i}     ← per-seat claim token, read:false
```

### Identity: secret link per seat

- **No login screen, no accounts.** Under the hood, Firebase **anonymous auth** (silent)
  gives every browser a stable `auth.uid`. This is the *same provider* as the database,
  so there is no separate auth service to wire up.
- On game creation the app makes N seats, generates N random **claim tokens**, and builds
  N secret links: `#/g/{id}/claim/{token}`. The creator hands each link to the right
  friend.
- Opening a claim link signs in anonymously and **binds** the seat to that browser
  (`seats[i].uid = auth.uid`) if the token matches. Whoever holds the link is that
  player; opening the link on a new device **re-binds** the seat (the token is the source
  of truth).
- Claim tokens live under a `read:false` path; security rules compare them on write so
  other players can't read them.

### Security rules (enforced server-side by RTDB)

- Normal moves: only the **active seat's** uid may write.
- 7-discards: only a seat with an outstanding `discardObligation` may write its discard.
- Trade acceptance: only the **addressed seat** (or any seat, for open offers) may accept.
- Every write must set `version === previous.version + 1` (rejects lost-update races).

This is deliberately *not* a full rules validator (that would require the rules engine on
a server, which we explicitly avoided). It prevents casual impersonation and races; it
does not stop a determined friend from hacking their own client. That is an accepted
trade-off for a trusted friend group.

---

## 6. Async-Catan design decisions

These are the cases where async play diverges from tabletop Catan:

- **Rolling a 7.** The active player moves the robber and steals *immediately* — the turn
  never stalls waiting on others. Players over the card limit (>7) get a
  `discardObligation` that is resolved whenever they next open the game. Discards apply
  independently and do not block the roller.
- **Trade offers.** An offer is posted during the proposer's turn and stays open until it
  is accepted, cancelled, or the proposer ends their turn. It is **re-validated at
  acceptance time** (the proposer may have spent the resources); if no longer possible it
  fails gracefully.
- **Concurrency.** Writes go through an RTDB transaction keyed on `version`. A stale
  action (computed against an older version) is rejected; the client reloads and
  re-evaluates, surfacing a friendly message if the action is now invalid.
- **Turn awareness.** On opening the game link, the UI clearly indicates whether it is
  your turn; actions are disabled and the board is read-only when it is not.

---

## 7. Base-game rules in scope

- 3–4 players.
- Snake-draft setup: each player places 2 settlements + 2 roads; the second settlement
  grants its adjacent resources.
- Resource production on dice roll (robber blocks its hex).
- Building: roads (connectivity rule), settlements (distance rule, on your road network),
  cities (upgrade a settlement). Bank/cost enforcement.
- Robber on a 7: discard-half for players holding >7 cards, move robber, steal one random
  card from an adjacent player.
- Development cards: full deck — knight, road building, year of plenty, monopoly, victory
  point — with correct timing (one card per turn, cannot play a card bought the same turn,
  knight playable before or after rolling).
- Trading: bank 4:1, ports 3:1 and 2:1, plus async player-to-player trade offers.
- Longest Road (≥5, including break/recompute on road or settlement changes).
- Largest Army (≥3 knights).
- Victory: first to 10 VP, checked on the active player's turn.
- Board generation: randomized standard layout (with standard tile/number/port
  distribution) plus a fixed beginner layout option.

---

## 8. Testing strategy

- **Engine (TDD, Vitest):** per-rule unit tests + full-game scenario tests that drive an
  entire game through `apply()` from setup to a 10-VP win. Deterministic via injected RNG.
  This is the project's primary safety net.
- **Geometry:** unit tests for vertex/edge adjacency and board generation invariants
  (correct counts, port placement, no illegal number adjacencies if enforced).
- **UI:** lighter — component tests for key interactions.
- **Net adapter:** an integration test against the Firebase emulator for the
  transaction + security-rule behavior.

---

## 9. Deployment

- Vite production build, published to GitHub Pages by a GitHub Actions workflow.
- Firebase web config is public and safe to ship in the client; security lives entirely
  in the RTDB rules.
- One-time: create a free Firebase project, enable Realtime Database + Anonymous Auth,
  paste the web config into the app config. RTDB security rules are version-controlled in
  the repo and deployed via the Firebase CLI.

---

## 10. Implementation phases

This single design covers the whole system. Implementation splits into three phases, each
becoming its own plan, built in order:

1. **Rules engine** (+ board geometry) — pure TS, TDD, no UI or network. Done when a
   complete game can be played to a win through `apply()` in tests.
2. **Local-playable UI** — React board + layout in the chosen art direction, playable
   hotseat in the browser on top of the engine.
3. **Networking + lobby** — Firebase adapter, anonymous auth, secret-link seat claiming,
   create/join flows, security rules.

We will write the Phase 1 plan first.
