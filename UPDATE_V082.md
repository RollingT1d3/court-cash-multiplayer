# Court Cash v0.8.2 — global three-point shooting rebalance

This update changes **all three-point shot attempts across every offensive strategy**. No defense, player, artwork, lineup, or non-three-point shooting changes were intended.

## Starting make probabilities

The player's **listed 3PT rating** selects the starting shot-make probability, before fatigue, positional adjustments, defender contests, shot distance, and other gameplay effects.

| Listed 3PT | Base accuracy |
|---|---:|
| 0–59 | 15% |
| 60–69 | 25% |
| 70–75 | 30% |
| 76–79 | 39% |
| 80 | 40% |
| 81–85 | 45% |
| 86–89 | 49% |
| 90 | 50% |
| 91–92 | 55% |
| 93–94 | 57.5% |
| 95–98 | 58% |
| 99 | 58.5% |
| 100 | 59% |

The request specified below 59 and then 60–69. **Exactly 59 is included in the lowest bracket (15%)**, so there is no undefined rating. Non-integer rating inputs are rounded, then clamped to 0–100.

## Distance deductions (percentage points, not percent multipliers)

| Shot distance | 0–94 rating | 95–99 rating | 100 rating |
|---|---:|---:|---:|
| 23–35 ft | 0 | 0 | 0 |
| 36 ft | −5 | 0 | 0 |
| 40 ft | −10 | −2 | 0 |
| 45 ft | −15 | −4 | −1 |
| 50 ft | −20 | −6 | −2 |
| 55 ft | −25 | −9 | −3 |
| 60 ft | −30 | −12 | −5 |
| 62 ft | −35 | −15 | −7 |

The intermediate distances are **linearly interpolated** between listed anchor points. Attempts over 62 ft use the 62-ft value. The existing shot-generation mechanic continues to create normal three-pointers from 23–30 ft and deep attempts from 36–62 ft.

## Technical implementation and compatibility

- `offense-v04.js`: `threePointBaseChance(rating)` and a rating-sensitive `longThreePenalty(distance, rating)`; omitting the rating retains the standard-tier penalty.
- `server.js`: listed 3PT stat determines base probability. Existing stamina and positional losses are applied continuously rather than selecting a sharply lower shooting tier as players tire. All existing defensive contests and other modifiers remain active, including final shot-probability clamping.
- `public/index.html` and `package.json`: v0.8.2 display and API version.
- `test/v082.test.js`: base-bracket, distance-anchor, interpolation, 95–100 special-tier, and integration-wiring regression assertions.
- Existing version assertions in old tests were refreshed to v0.8.2. Playbook designs, shot-attempt frequencies, court graphics, and all player data were not changed.

The 95–100 tier has **nonzero extreme-distance penalties** per the user's approved revision.
