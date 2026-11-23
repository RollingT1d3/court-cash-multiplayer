# Court Cash v0.8.3 — Height-Based Shot Contests & Interior Blocks

Height now has a small effect on jump-shot contests, a stronger effect on layup/dunk contests, and a slight effect on the probability of blocking an interior attempt. This applies globally, with no offensive strategy exclusions.

## Height mismatch accuracy effects

Height difference compares the **defender to the shooter**. A positive accuracy adjustment means the defender is shorter and shooting is easier; a negative adjustment means the defender is taller and shooting is harder.

| Defender compared with shooter | Three / mid-range | Layup / dunk |
|---|---:|---:|
| 12+ inches shorter | +5 percentage points | +8 percentage points |
| 9–11 inches shorter | +4 pp | +6 pp |
| 6–8 inches shorter | +3 pp | +4.5 pp |
| 3–5 inches shorter | +1.5 pp | +2.5 pp |
| Within 2 inches | 0 | 0 |
| 3–5 inches taller | −1.5 pp | −2.5 pp |
| 6–8 inches taller | −3 pp | −4.5 pp |
| 9–11 inches taller | −4 pp | −6 pp |
| 12+ inches taller | −5 pp | −8 pp |

## Interior shot block-probability adjustments

| Defender relative to shooter | Block chance |
|---|---:|
| 12+ inches taller | +2 pp |
| 9–11 inches taller | +1.5 pp |
| 6–8 inches taller | +1 pp |
| 3–5 inches taller | +0.5 pp |
| Within 2 inches | 0 |
| 3–5 inches shorter | −0.5 pp |
| 6–8 inches shorter | −1 pp |
| 9–11 inches shorter | −1.5 pp |
| 12+ inches shorter | −2 pp |

This block modifier applies to **layups and dunks only**, before existing block-chance bounds and the Clog The Lanes defensive multiplier. Consequently the final effect may be reduced when caps apply or Clog The Lanes is active.

## Implementation

- `height-rules-v083.js` provides independently testable `heightContestAdjustment` and `heightBlockAdjustment` helpers.
- `server.js` applies the shooting-height adjustment to the existing probability formula and the block-height adjustment to the interior-only block formula. Ratings for Perimeter Defense, Paint Defense, and Block continue to matter, as do other defense and fatigue mechanics.
- The previous interior `sizeEdge` scoring bonus in `shotMismatch` has been removed to avoid **double-counting height under Pure Chaos**. Other mismatch factors remain intact.
- All v0.8.2 three-point base probabilities and deep-distance tiers remain unchanged.
- `test/v083.test.js` covers every band and positive/negative case, and checks the gameplay integration. Older version-specific tests now expect v0.8.3.
- `package.json`, the `/health` version field, and the main menu all use **v0.8.3**.
