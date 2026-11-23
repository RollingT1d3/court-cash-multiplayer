# COURT CASH v0.8.1 — 4–1 Zone, 2–2–1 Zone & 🖐️ Blocks

## New defense: 4-1 Zone

**In-game explanation:** Four defenders spread along the three-point arc to contest outside shots and passes, while the Center guards the paint alone. Strong against perimeter shooting; drives, interior scoring and offensive boards become easier because the Center gets little help.

**Behavior:** Four perimeter positions (PG/SG/SF/PF) and one rim safety (C) are drawn and simulated. Perimeter contests reduce the opposing made-three chance by 9 percentage points and made-midrange chance by 4 percentage points before final shot clamps. Interior attempts gain a 9-point advantage; the offense gets +4 percentage points on offensive rebound chances. The Center is the single primary defender against paint attacks. This is a *half-court zone*, not a full-court press.

## New defense: 2-2-1 Zone

**In-game explanation:** A full-court zone press: two defenders pressure the ball high, two cover the middle passing routes, and one stays back to protect the basket. Can force occasional eight-second violations and extra steals, but uses more stamina and can give up open shots once beaten.

**Behavior:** Two high, two middle, one back are visible and used in pass-lane geometry. Each defensive possession has a **4%** chance of an eight-second violation (vs. 10% with Full Court Press). Eligible, in-lane interception chances are multiplied by **1.3**, with the existing rule that **90+ Passing is never interceptable** fully preserved. On-ball steals gain **+0.4 percentage points** (not 0.4×). Defending players use **20%** more stamina, and attacking players against this press expend **7%** extra stamina. When teams advance past the press, shot success gets **+4 percentage points** across shot types. The single back defender is chiefly responsible for the paint.

The precise bonuses above are provisional balance choices. The request specified the formation and new strategies, not percentages. All are set in `defense-v081.js` for later tuning.

## Shot block visual

When a shot is **blocked**, a single 🖐️ briefly appears directly halfway between the **actual, on-screen blocker and shooter circle positions**. The marker is visible for less than **0.85 seconds**, then fades. It is absent for missed, made or fouled shots and other events. This is purely visual and does not change existing block/steal/rebound ratings.

## Compatibility & QA

- All 10 offensive strategies, existing 7 defensive strategies, four 25%-each courts, MVP/DPOG, winner screen, rematch, timeout rules, draft and roster are unchanged. There are now **9 defensive strategies**.
- The new strategies appear both in pregame lineup settings and during timeouts.
- `test/v081.test.js` covers geometry, bonus/weaknesses, possession odds, passing immunity and block icon positioning.
- `test/v081-integration.test.js` completes a real two-player draft and game with the two new zone defenses, then starts a rematch.
- **75/75 automated tests passed locally** under Node.js 22.
- Verify deployment independently: `https://court-cash-multiplayer.onrender.com/health` should show `"version":"0.8.1"`, and the site header should read `ALPHA v0.8.1`.
