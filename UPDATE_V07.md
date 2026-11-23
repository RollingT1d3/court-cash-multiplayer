# COURT CASH v0.7.0 — Ankle Breakers, Possession-Locked Timeouts & Poster Celebrations

## 1. Ankle breakers (once per live ball-handler possession)

The server uses each on-ball handler's **listed Dribbling** and their matched defender's **listed Perimeter Defense**, with no position, fatigue, or OVR adjustment to these exact probability brackets:

| Handler Dribbling | Chance of an ankle breaker before defensive adjustment |
| --- | ---: |
| Below 80 | 0% |
| Exactly 80 | 1% |
| 81–85 | 1.5% |
| 86–89 | 2% |
| Exactly 90 | 3% |
| 91–94 | 4% |
| 95–98 | 4.5% |
| Exactly 99 | 4.8% |
| 100 | 5% |

| Defender Perimeter Defense | Deduction in **percentage points** |
| --- | ---: |
| Below 80 | 0 |
| Exactly 80 | −0.5 |
| 81–85 | −1 |
| 86–89 | −2 |
| Exactly 90 | −3 |
| 91–95 | −3.5 |
| 96–98 | −4 |
| 99–100 | **Immune: cannot have ankles broken** |

All resulting chances are clamped at zero. The ankle-break roll occurs **only after a ball handler survives the passing and on-ball-steal stages**; the server never repeatedly rolls each animation frame. The occurrence is recorded for that handler in the player stats (`AB`). A successful crossover knocks the current defender off the play and gives the handler a brief 12-percentage-point immediate shot advantage (initial tuning value chosen because none was specified), with the stumbled defender unable to block or commit a shooting foul on that attempt.

**Animation:** the defender briefly rotates/staggers away and displays 😵‍💫 directly above their head; the court's outskirts briefly flash scattered 🫪, 😱, and 😯. The main effect lasts roughly one second.

## 2. Timeouts: ball possession required

- Only the team with **server-confirmed possession** may spend a timeout. The defending team sees a disabled timeout button; the server also rejects direct invalid API requests without consuming a timeout.
- A timeout freezes the game and keeps the original offense. Both teams can change strategies; only the caller can substitute, same as before.
- On early resume **or** normal 30-second timeout expiration, **the same team still has possession** and makes an actual inbound pass before its next play, marked on court and in the play-by-play. That pass obeys v0.5 pass-out-of-bounds and interception rules.

## 3. Poster dunks: overwrite the old player flames

The old poster-dunk flames over the two players were removed. Instead, for a brief animation only:

- 💪 directly above the basket scored on
- 🗣️ over the dunker's head
- 😢 alongside the defender who was dunked on
- 📸😯, 📸, 🫪 distributed around the court's outskirts

The unrelated 🔥 effect for exceptionally deep three-pointers remains intact.

## Compatibility, tests & deployment

- The four courts, v0.6 strategies, roster, drafting, 90+ passing immunity, screening, fouls, fatigue and substitutions remain.
- New pure odds helpers are in `ankle-rules-v07.js`; authoritative game logic in `server.js`; client animations in `public/app.js`.
- `test/v07.test.js` checks all boundary values, defensive 99/100 immunity, zero floor, event and animation wiring. `test/v07-live.test.js` uses a **test-only** ankle trigger to verify a complete two-player simulation, possession security and next-pass inbound. Production never uses the test-only trigger.
- **60/60 automated tests passed locally** with Node.js v22.
- Live website verification: open `/health` on the Render service and check `"version":"0.7.0"`, plus `ALPHA v0.7.0` in the site header. The GitHub push alone does not confirm successful Render deployment.
