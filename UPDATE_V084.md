# Court Cash v0.8.4 — Fatigue Rebalance & Player-Controlled Substitutions

## 1. Fatigue attributes and performance

Current energy remains from 0 to 100, and each player's existing Stamina rating still governs how quickly energy drains. All preexisting strategy-related energy multipliers and bench recovery remain in place.

Fatigue now multiplies effective ratings depending on their category:

| Energy | 3PT / Mid-range (up to −18%) | Layup / Dunk / Post (up to −12%) | Perimeter Defense / Paint Defense / Block / Steal (up to −10%) |
|---|---:|---:|---:|
| 100 | 100% | 100% | 100% |
| 75 | 95.5% | 97% | 97.5% |
| 50 | 91% | 94% | 95% |
| 25 | 86.5% | 91% | 92.5% |
| 0 | 82% | 88% | 90% |

The game preserves its original continuous fatigue handling for the v0.8.2 3PT base brackets, avoiding abrupt base-tier shifts as a shooter tires. Defensive fatigue applies to actual paint/perimeter contests, shot blocking, passing-lane steals and on-ball steals. Playmaking (Passing and Dribbling) retains the existing listed-rating behavior; the listed-rating ankle-breaker immunity mechanic is also preserved.

## 2. Timeout energy recovery

When a valid timeout is called, **all ten active players** (both teams) immediately recover **+4 energy**, capped at 100, exactly once per timeout. Players who are on the bench at that moment do not receive the timeout recovery. A player substituted in during that timeout therefore doesn't retroactively get the +4 bonus.

The existing five-timeout-per-team limit, possession requirement and 30-second window remain unchanged. Bench recovery remains tied to simulated game time, not the real-time pause.

## 3. Manual-only voluntary substitutions

Automatic substitutions after possessions are removed. Fatigued players stay on the floor until their manager changes them, with voluntary substitutions permitted only **during a timeout called by their own team**. There are no free changes between plays or quarters, and a mandatory player-selected bench replacement is still required on a six-foul disqualification without calling a timeout.

## 4. Visible fatigue indicators

| Energy | On-court indicator |
|---|---|
| 60–100 | None |
| 25–<60 | Small 💦 badge |
| 0–<25 | Small 🥵 badge |

The emoji is now a small **12-pixel** symbol in a circle whose center is near the top-right boundary of the moving 48px-diameter portrait (offset +16px right, −16px up). It moves with the player, overlaps only a small portion of the portrait, and leaves the player name visible.

The player info panel still gives the exact energy percent. No new stamina/energy bars were added to the substitution menu.

## 5. Compatibility and QA

- Unchanged: V0.8.2 3PT probabilities and deep-shot penalties; V0.8.3 height-based shot contests and block modifiers; roster, court art, possessions, existing strategies, normal energy drain, and bench recovery.
- `fatigue-v084.js` exports pure helpers for category-specific fatigue and timeout recovery.
- `server.js` uses category-appropriate multipliers for offense/defense, +4 energy on a valid timeout, and manual substitutions only.
- `public/app.js` updates the fatigue symbols, placement and exact-energy display label.
- `test/v084.test.js` validates all fatigue categories, exact recovery values, manual substitution guards and fatigue-icon rendering conditions.
- `package.json` and the user-facing menu show **v0.8.4**.
