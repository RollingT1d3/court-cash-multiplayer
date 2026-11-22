# COURT CASH — Update 0.4.1: Tipoff

## Opening tipoff

At the start of each game, the **players occupying the two starting C slots** contest the opening jump ball. Their **heights alone**, measured in inches, set the chances:

| Taller player's height advantage | Taller player wins | Shorter player wins |
|---|---:|---:|
| 0 inches | 50% | 50% |
| 1–2 inches | 55% | 45% |
| 3 inches | 65% | 35% |
| 4–5 inches | 80% | 20% |
| 6 inches | 90% | 10% |
| 7 or more inches | 95% | 5% |

The winning team gets the game's first possession. The game state records both center IDs,
both heights, chances for each team, and the winner. The result is announced in the
play-by-play and briefly in the scoreboard at the start of each game. The jump-ball
winner is redetermined for each game in a series using that game's starting centers.

No other player attribute (strength, speed, OVR, etc.) is used in the opening tip.
This rule replaces the previous random opening-possession selection. It does not
implement a separate jump ball at the start of later quarters or overtime.

## Testing

`npm test` covers all height-difference brackets and both team orientations, exact
threshold and edge cases, and the full preexisting multiplayer gameplay tests.

## Scope

The homepage images remain untouched, as requested for v0.4. The roster data and
custom-player backups remain unchanged. This is an update to website source code,
not proof of a completed Render deployment.
