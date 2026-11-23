# COURT CASH v0.8.0 — Shot Celebrations, Point/Center Strategy, Lane Defense & Winner Screen

## Made basket captions
- A made **mid-range field goal** briefly displays **SWISH!** in bold, outlined white lettering immediately above the basket scored on.
- A made **three-pointer** similarly displays **3PTS!** above that basket.
- No caption appears on misses, free throws or made layups/dunks; poster/deep-three effects remain separately available.

## Offense: Play Through Point
**In-game description:** Shooters fill the corners, and the Point Guard & Center run the offense.

- The starting **PG** and **C** own the primary actions. The two best listed **3PT** shooters **among SG/SF/PF** space to opposite corners; the third wing cuts/spaces.
- On PG-led plays the **Center sets a real screen** (subject to the existing Strength and IQ-screen rules) and can roll inside or pop outward according to their strongest interior versus outside skills.
- Variations include PG drives + corner kickouts, PG rim attacks, direct Center paint touches, Center screen-and-roll/pop attempts, and a wing cutting to the hoop for a possible layup/dunk; an ignored cutter moves back out to the arc.
- All actual passes still use the existing v0.5 Out-of-Bounds, pass-speed, interception, and 90+ Passing immunity rules; the league continues counting possessions, steals, rebounds, screens, and turnovers as usual.
- Mode weights are *initial implementation settings*: 28% PG kickout, 20% PG drive, 18% direct Center attack, 18% Center roll/pop, 16% wing cut/return. These can be tuned without rewriting the strategy.

## Defense: Clog The Lanes
**In-game description:** Makes it harder for passes to connect as defenders focus heavily on blocking off passing lanes.

- The defense positions up to three players **geometrically in each pass path**, with the remaining two covering wings/sides rather than protecting the painted area. Both clients display these per-play defensive positions.
- Eligible in-lane players receive **2.5× the existing passing-lane interception chance**, with a maximum probability of 100%. A defender still must actually be in the lane, and **passing 90+ is always immune**.
- Leaving the paint unprotected gives opponents a **+11-percentage-point interior shot advantage**; blocks against those shots are multiplied by **0.45**, and the offense receives a **+5.5-percentage-point rebound advantage**.
- These numeric bonuses were chosen as initial tuning parameters where the request specified relative direction rather than a strict number.

## Winner, MVP, DPOG, and rematch
- The **server** computes awards for the current game, on the final score (including series games and valid forfeit completions), and sends the same authoritative results to both clients.
- Huge gold **WINNER: TEAM NAME** headline; center gold 🏆MVP🏆 with the player's **full name**, **original full player illustration** when one exists (initials otherwise), and **top three positive stat categories**; left 🔒DPOG🔒 with player name, original illustration, **steals** and **blocks**.
- **MVP score = PTS + AST + REB − TOV**, winning-team roster **only**. **DPOG score = BLK + STL** across both rosters. The **same player can win both**. Deterministic ties are decided by PTS for MVP, STL for DPOG, then player ID.
- The right side shows both teams' full stat totals (PTS/REB/AST/STL/BLK/TOV/FG/3PT/FT/PF) plus **Offense and Defense grades (0–100)**. The grading formulas are explicit and deterministic in `awards-v08.js` because no grading formula was specified; they can be balanced later.
- **MAIN MENU** at the top right locally closes the room view and takes the user to the game's home screen.
- **REMATCH!** (large white type on red) at the bottom right of a finished match sends one ready vote to the server. **Both players must press it**. The game does not restart on a single vote. When both confirm, the game **reuses the drafted rosters**, resets stats, fatigue, timeouts, series wins and court roll, and begins a fresh tipoff. For best-of-seven intermissions, the winner display includes **ADJUST STRATEGIES / NEXT GAME** instead.

## Compatibility & verification
- All previously implemented shot probabilities, 4 evenly weighted courts, v0.6 strategies, ankle breakers, controlled timeouts, portrait/face crops and poster visual effects remain.
- `strategy-v08.js`, `awards-v08.js`, `server.js`, `court-rules-v05.js`, `public/app.js`, `public/style.css` and two dedicated v0.8 tests implement the update.
- **68/68 automated tests passed locally**, including complete real two-player games, completed awards, and a fresh match after both rematch votes.
- Render deployment must be checked separately from GitHub: visit `/health` for `"version":"0.8.0"` and look for **ALPHA v0.8.0** in the menu header.
