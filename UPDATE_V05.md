# COURT CASH v0.5 — Screens, passing and steals

## Screens
- The simulator selects an actual on-court player (not the shooter) to set a screen.
- The stronger the screener, the larger the legal-screen shot-quality bonus. Stronger players also receive more weight in the screener selection; the impact is additive to existing teamwork/screen effects.
- Each **attempted** screen has an IQ-based illegal-screen foul probability, using the screener's **listed IQ**: ≤60 = 20%; 61–70 = 15%; 71–79 = 9%; 80–89 = 5%; 90+ = 1%.
- An illegal screen is an **offensive personal foul and turnover** credited to the actual screener. Six personal fouls disqualify a screener and trigger the same mandatory substitution workflow as defensive foul-outs.

## Passing
- On most possessions, an on-court teammate makes a pass to the designated shooter before the shot. Some possessions instead remain isolation/dribble plays.
- The pass animation is faster for players with higher **listed Passing**. Flight duration ranges from 570 ms at 0 Passing to 170 ms at 100 Passing.
- An attempted pass has the following independent **out-of-bounds** chance: ≤65 = 10%, 66–70 = 8%, 71–79 = 5%, exactly 80 = 1%, 81+ = 0%.
- An out-of-bounds pass is a turnover credited to the passer; no shot occurs.
- A completed pass may produce an assist if the shooter makes a field goal. Assists are credited to the **actual passer**, not retrospectively assigned to an unrelated teammate. No-passing possessions do not produce assists.

## Passing-lane interceptions
- Defensive players must be **in the geometric lane** from the passer to the receiver based on the game’s normal five-man court anchors and selected zone scheme. Off-lane players have zero interception probability.
- For eligible in-lane defenders, **listed Steal**: 80 = 2%, 81–85 = 4%, 86–89 = 5%, 90–92 = 6%, 93–98 = 7%, 99 = 8%, 100 = 10%; below 80 = 0%.
- **Listed Passing 90 or higher can never be intercepted**, regardless of in-lane defender Steal ratings. Position-adjustment penalties never remove this immunity.
- Successful interceptions credit an actual defensive player's Steal and the passer's Turnover and end the possession.

## On-ball steals
- Only the on-ball defender gets a steal attempt against the handler, with the defender's **listed Steal** bracket: ≤69 = 0%, 70 = 1%, 71–75 = 1.5%, 76–79 = 2%, 80–84 = 3%, 85–87 = 3.5%, 88–89 = 4%, 90–94 = 4.5%, 95–98 = 5%, 99 = 5.5%, 100 = 7%.
- Subtract the ball-handler's **listed Dribbling** reductions in percentage **points**: <80 = 0, 80 = −1, 81–84 = −1.5, 85–89 = −2, 90–94 = −2.5, 95–98 = −3, 99 = −3.5, 100 = −4.
- The final chance cannot be negative. On-ball steals are separate from interceptions and credit the actual ball-handler's Turnover.

## Game and presentation
- Only one disruption can occur per possession; resolution is: illegal screen, out-of-bounds pass, passing-lane interception, on-ball steal, normal attempt.
- The live court animates the pass at its rated speed and displays different banners for illegal screens, errant passes, interceptions, and strips. Existing shooting, poster effects, highlights, fatigue, substitutions and strategies remain.
- Uses `court-rules-v05.js` for isolated testable probability tables and court-lane geometry; `server.js` for authoritative possession results and `public/app.js` for visual presentation.
- This update keeps the current placeholder player roster. The custom 83-player roster is **not** inserted by this update.
