# COURT CASH v0.6.0 — Run For The Hills & Full Court Press

Two new selectable strategies in both lineup preparation and midgame timeouts.

## Run For The Hills (offense)
- Inbounds with the highest listed Passing player **among the four positions other than the current PG slot**.
- All four other active players randomly shuffle offensive running lanes each possession and drive toward the basket; slight **7% movement speed boost**.
- Two equally likely main play branches: **crash the paint** (layups/dunks) or **two best available shooters flare out** to attempt whichever of 3PT and Mid-Range they rate higher. Kickouts succeed in finding a shooter ~67% of their attempts; otherwise a paint player finishes the route.
- Paint crash adds **8 percentage points** to the chance of an offensive rebound; a flare-out play adds 4. Crashing rebounding players receive extra selection weight.
- **Half of successful crash-mode offensive rebounds immediately attempt a putback**, recording a separate field-goal attempt and two points if made. Other offensive rebounds can retain the possession.
- Running offense drains **14% more stamina** (multiplied with any defensive press drain).
- Passing out-of-bounds/interception percentages from v0.5 still apply to the actual non-PG inbound passer, including the **90+ Passing interception immunity**.

## Full Court Press (defense)
- Full-court defenders take advanced court positions rather than the usual half-court or zone anchors.
- **10% chance per defensive possession** to cause an **eight-second violation**. The violation consumes eight simulated seconds, credits an offensive turnover, and awards no defensive steal.
- On-ball steal opportunities gain a small **0.8 percentage-point bonus**, after v0.5 Steal/Dribbling deductions. Pass-lane interceptions still require an actual passing lane and retain the 90+ Passing immunity.
- Pressing defenders use **75% more stamina** per on-court stint, and ball handlers/attacking opponents use **16% more**, in addition to any additional offensive scheme fatigue.

## Deployment and compatibility
- Version **0.6.0** appears in header and `/health`; previous four equally likely courts, taller v0.5.2 geometry, custom headshot readiness, draft, shooting foul and previous strategy mechanics are retained.
- Server sends route targets and mode flags to both players for synced on-court animation, and logs press violations and putbacks.
- Percentages not dictated numerically in the feature request were selected as provisional implementation constants in `strategy-v06.js` so they can be adjusted easily.
- Changes are committed to GitHub; Render live deployment is not established until `/health` confirms version 0.6.0.
