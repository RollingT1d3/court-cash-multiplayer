# COURT CASH — v0.4 Gameplay Update (no new homepage artwork)

## From Deep celebration

- Each three-point attempt receives a distance. A standard three is approximately 23–30 feet.
- Occasionally a player attempts a very deep three from approximately 36–62 feet: near midcourt, at midcourt, or beyond it. Desperation as the shot clock approaches zero increases the chance of a deep attempt.
- Longer-distance threes have a meaningful additional make-probability penalty; shot quality still uses the player's 3PT rating, defense and fatigue.
- A **made** deep three causes a brief (~1.65-second) 🔥 over the shooter, another 🔥 over the scoring rim, and a bright red/orange center-screen **🔥FROM DEEP!🔥** banner. It is also recorded in play-by-play.
- No celebration is displayed for a missed deep attempt or regular three.

## Run & Gun

- Strongly perimeter-focused offense prioritizing the **two highest 3PT-rated active players**.
- The other three players move and screen to free them, especially the **two weakest combined 3PT + MID shooters**, who are excluded from normal field-goal attempts and instead specialize in screening and rebounding.
- The remaining third eligible shooter looks for open mid-range shots when their MID rating is at least 80. Screen quality and adherence depend on Teamwork and player ability.
- Screening gives a modest shot-quality advantage and uses slightly more stamina. Screeners have more involvement in rebounds and assists.

## Old-School Buckets

- A moderately interior-focused scheme. The best 3PT shooter is assigned the three-point arc; the strongest *other* rebounder anchors near the rim. If the best three-point shooter is also the top rebounder, the next-best rebounder fills the inside job.
- The other three players create cuts, interior scoring, open mid-range looks, assists, and off-ball screens.
- On a low modeled shot clock or an open look, the offense strongly prioritizes a kickout to its arc specialist. Teamwork affects successful execution.
- The designated paint rebounder receives a larger rebound weight. Screen/cut actions have a small shot-quality and assist effect.

## Unchanged

- The two requested homepage images are **not part of this update**. No image editing, removal, or addition to the homepage.
- Existing v0.3 foul-out rules, timeouts, defensive schemes, and all prototype player data remain intact.
- The separate 83-player custom master roster and original illustrations remain outside this prototype repository.
- This is a probabilistic animated basketball simulation, not full real-time player-physics tracking.

## Verification

`npm test` runs eight automated tests, including multiplayer full-game behavior, six-foul substitutions, offensive roles and deep shot geometry.
