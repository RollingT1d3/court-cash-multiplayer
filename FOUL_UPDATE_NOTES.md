# COURT CASH v0.3.0 — Shooting Fouls & Mandatory Substitutions

This complete Node.js multiplayer prototype builds on **v0.2** (5 timeouts, 8-minute real-time
simulation, Teamwork influence, strategy explanations, poster fire, 3-2 Zone, Pure Chaos).
It is a **local source update**; no live website has been redeployed. The roster in
`data/players.json` is still **temporary prototype players**, not the separate 83-player
custom master backup.

## Shooting foul probability (per defended attempt)

| Shooter FT | 3PT or mid-range | Dunk or layup |
|---|---:|---:|
| 0–79 | 2% | 5% |
| 80–85 | 3% | 6% |
| 86–89 | 4% | 7% |
| 90–99 | 5% | 8% |
| 100 | 7% | 10% |

All modeled shot attempts have an active defender. Turnovers that occur before a shot attempt
are excluded. Shooting fouls are credited to the defender's **PF** statistic and award the
shooter **three free throws on a 3PT attempt** or **two on a mid-range attempt, layup, or
dunk**. Each individual free throw succeeds according to the player's FT rating (e.g.,
85 FT gives an 85% make chance). Made FTs contribute to score and individual PTS/FTM;
attempts are tracked under FTA. The fouled shot is **not** counted as an FGA/3PA. No
and-one shots, loose-ball fouls, or shooting-foul rebounds are simulated in this version.

## Six-foul disqualification

- After **six personal fouls**, mark that player permanently **fouled out** for the current
  game. This resets for the next game in a series.
- **Pause the simulation and game clock** until the *affected team's player* selects an
  eligible substitute from that team's bench. Only a valid replacement can resume play.
- Mandatory substitution **does not spend a timeout**. The opposing team cannot choose
  the replacement. The disqualified player cannot reenter, including through regular
  timeouts or energy-based automatic substitution.
- Across all in-game portrait placements and the final box score, the disqualified player's
  picture becomes **grayscale with a large red X**. The live box score shows PF, FT and
  disqualification status.
- Edge case: if no eligible bench replacement remains, the team cannot legally field five
  players and loses that game by disqualification.

## Testing

Run `npm test` from the repository root. Four tests cover exact chance brackets,
FT and eligibility logic, a forced six-foul live multiplayer pause/replacement/invalid
substitution, and the original complete-game test. The forced foul environment flag is
honored **only with NODE_ENV=test**, not in normal games.

## Deploy

These updates live in the tracked root of the existing repository.
The site's deployment depends on its hosting configuration. Do not overwrite
the separately saved custom-player backup with sample prototype data.
Redeploying resets currently active in-memory multiplayer rooms.
