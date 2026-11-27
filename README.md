# Court Cash — multiplayer basketball auction prototype (v0.2.0, deploy-ready)

A working **desktop-first, two-browser, real-time** basketball auction and condensed 2D basketball simulation proof of concept. The game server, not the browsers, owns the coin flip, weighted wheel, budgets, turns, roster assignments, timeout rules, and game results.

> **Status:** Local prototype, not an already published website. It contains 32 invented **temporary** basketball players and initials in place of portraits. It is not a production-ready deployment; see Limitations below.

## Put it online (GitHub + Render)

**Open `DEPLOY_ONLINE.md` for beginner-friendly click-by-click steps.** This package includes `render.yaml` for Render Blueprint deployment on the Free web-service plan, plus a pinned Node runtime. It is **not live yet**: the repository and service must be created in your own accounts.

## Run it on your computer

1. Install Node.js **22**.
2. Extract this archive and open a terminal in the `court-cash-multiplayer` folder.
3. Run `npm start` (there are **no external npm package dependencies**).
4. Open `http://localhost:3000` in Chrome, Edge, Firefox, or Safari.
5. Create a room and share its six-character code. Your friend joins the *same server* using the same website in a separate browser.

For a friend on another computer on the **same home network**, they can open `http://YOUR-LAN-IP:3000` if your computer firewall allows incoming connections to port 3000. For friends in different places, deploy the Node server to a public host that keeps an active Node process and supports long-lived Server-Sent Events connections. **The game is not hosted by this ZIP file**, and simply opening `index.html` won't start multiplayer.

**Typical public hosting approach:** Push this folder to a Git repository, create a Node web service on a Node-compatible host (for example Render or Railway), set its start command to `npm start`, and obtain the host's public URL. Configure the service as an always-on web process if possible. The server reads `process.env.PORT`, so the host can assign the port. Both players visit the public URL; one creates the room, the other joins.

## Game modes and rules implemented

- Two synchronized clients using room code + per-player session token. Refresh can reconnect from the same browser tab; a 30-second connectivity grace period applies if an opponent is present.
- Random coin flip determines the first opener. Auctions alternate opening bidder by wheel spin.
- Weighted wheel: each available player's `weight` determines their relative selection probability. Player removed after award, only for the current match.
- Each team starts with $50; $1 minimum opening bid, minimum $0.50 increment, higher jumps in $0.50 steps, 30 seconds per bidding turn, deadline resets after each valid raise.
- When either team cannot afford the $1 minimum, the other team gets free Select/Pass choices. With a full roster on one side, the remaining side receives players automatically. With neither side able to bid, assignments alternate to eligible slots.
- Eight players per roster, five named starting positions plus sixth and two bench slots; slot assignment and swapping by drag or click. Listed positions are penalty-free; other positions incur dynamically calculated penalties influenced by attribute suitability and size.
- OVR badges by tier; role-adjusted OVR on roster slots. Expandable weighted category ratings and individual attributes during bidding.
- Six offensive schemes (including **Pure Chaos**) and five defensive schemes (including **3-2 Zone**); each affects the possession model. Plan adherence depends strongly on individual **Teamwork**.
- Single-game or best-of-seven series, with scheme changes between games.
- 40-minute regulation game (four 10-minute quarters, with 3-minute overtime periods if tied), with a full-court 2D display, ten player markers, basketball ball movement, scoreboard, player statistics, stamina, fatigue effects, automatic substitutions, play-by-play, brief poster-dunk comic reactions (💪, 🗣️, 😢, 📸😯, 📸, 🫪), and a final box score.
- Six 45-second timeouts **per game per team**. Only the team **in possession** may call timeout; only that team may manually substitute, but **both** teams may edit schemes. Caller can resume early, and its team inbounds afterward.
- No injuries, no home-court advantage. Overtime if tied.

## Adding custom players and pictures

Edit `data/players.json` (original 200) or `data/players-3.json` (expansion players). The server loads both into a single roster. Each player object has:

```json
{
  "id": "unique-player-id",
  "name": "Example Player",
  "positions": ["PG", "SG"],
  "heightInches": 79,
  "archetype": "Two-Way Playmaker",
  "overall": 91,
  "weight": 2.5,
  "image": "/images/example-player.png",
  "stats": {
    "layup": 85, "dunk": 78, "post": 65, "ft": 84,
    "mid": 87, "three": 91, "fades": 85,
    "passing": 91, "dribbling": 92,
    "paintDef": 70, "perimeterDef": 87, "block": 59, "steal": 86,
    "rebound": 74, "strength": 81, "speed": 89,
    "iq": 90, "teamwork": 87, "stamina": 91
  }
}
```

Copy the actual image into `public/images/example-player.png`. If an image is not ready, set `"image": null` and the UI shows initials instead. Restart the server after changing the JSON.

`weight` is a **relative probability weight**, not a guaranteed chance across every stage. If all players' weights initially add to 100, a weight of 2 corresponds to a 2% chance on the first spin. After players are drafted, remaining weights automatically renormalize to 100%.

All sample players included in the archive are invented for testing and **do not represent the user's actual custom stat sheets, ratings, images, or percentages**. Provide real stats/images to replace them later.

## Test

Run `npm test`. Automated integration tests exercise a real two-player game server through create/join, coin flip, wheel, bidding, no-money free selection, draft completion, schemes, timeouts, lineup substitution, and final result.

## Limitations and production checklist

- The game state lives in the server's memory; **restart clears active matches**. Add persistent storage before production release.
- Simulated basketball is a first-pass weighted possession model; it doesn't yet have full foul/free-throw/and-one logic, sophisticated playbook physics, precise player tracking, or a truly rendered 3D game. Face/ball movement is an animated representation of server-generated plays, not recorded footage.
- The temporary sample data and first-pass category and position weights need to be tuned with real players.
- Room/code abuse prevention, account login, scaling to multiple server instances, long-running session persistence, anti-spam/rate limiting, image upload/admin interface, and polished mobile support remain future work.
- For hosting to friends across the internet, use a hosted **Node server** with continuous connection support; static-only hosts (e.g. GitHub Pages by itself) cannot run the multiplayer server.
- When hosting, ensure reverse proxies are configured to permit EventSource streaming and do not terminate idle connections prematurely.

## Files

- `server.js`: Node HTTP API, authenticated game room state, SSE multiplayer transport, rules and possession simulator.
- `public/index.html`: user interface.
- `public/style.css`: desktop-first visual styling.
- `public/app.js`: synchronized client rendering, player stats, wheel, roster drag/click interactions, and animated full-court canvas.
- `data/players.json` and `data/players-3.json`: original and expansion roster, attributes, weights and image references. The roster contains 268 players: 250 with positive published odds totaling exactly 100%, and 18 new players (#251–268) initialized at zero until rebalanced. Players #218–250 have a combined starting weight of 6.15%. Complete 200-, 217- and 250-player probability backups remain importable and add new IDs at zero. Zero-weight roster additions preserve matching previously saved admin odds. A new published default probability set supersedes older saved admin settings; subsequent admin edits persist across restarts on the same published baseline.
- `test/game.test.js`: full-match integration test.

## November 2026 gameplay update (v0.2)

- **6 timeouts per team, per game (45 seconds each)**, reset for each game of a best-of-seven series; timeout may be called only by the team currently holding possession. That team inbounds when the timeout ends. Only the calling team can manually substitute during its timeout; both sides can update schemes.
- **Simulation pacing:** Full 40-minute regulation (four 10-minute quarters) with a default 3,250 ms base possession interval; animations, timeouts and any 3-minute overtime periods extend real duration. Fast automated tests can still override `SIM_MS`.
- **Offensive discipline:** Individual Teamwork changes how strongly a player follows the selected shot distribution, star prioritization, ball movement and screen/mismatch plays. Low-Teamwork players are less likely to follow a play as called.
- **Pure Chaos:** Extra screen actions, animated off-ball cutting, mismatch hunting using defensive ratings/height/strength, small shot-creation bonuses when executed, and modest stamina cost.
- **3-2 Zone:** Three defenders high, two inside; improved outside contesting, weak inside protection and defensive rebounding.
- **Strategy explanations:** All schemes describe what they do when selected in pregame, between-game preparation and either team's timeout.
- **Poster dunk:** On some contested made dunks, both the dunker and the defender briefly show a fire emoji on the court.
- This remains a **prototype simulation**, not full physics; the display is event-driven and results depend probabilistically on attributes.



## v0.3 foul and substitution rules

See `FOUL_UPDATE_NOTES.md` for shooting foul odds, FT scoring, six-foul ejections, mandatory substitutions, portrait treatments, and tests.

## v0.4 (no artwork changes)

See [UPDATE_V04.md](UPDATE_V04.md) for the new Run & Gun and Old-School Buckets offensive strategies and the long-range three-pointer celebration. All player images and homepage artwork were left unchanged.

## v0.7 ankle breakers, possession-only timeouts & poster celebrations

See [UPDATE_V07.md](UPDATE_V07.md) for exact Dribbling/Perimeter Defense crossover odds, temporary open-shot treatment, possession-preserving timeout inbounds, comic emoji animations for poster dunks, and the test coverage.

## v0.8.0 — new strategies, end-game awards, rematches

Read [UPDATE_V08.md](UPDATE_V08.md) for **Play Through Point**, **Clog The Lanes**, SWISH!/3PTS! shot captions, the MVP and DPOG score formulas, team Offense/Defense grades and the mutual-rematch winner screen.

## v0.8.2 — global three-point accuracy and distance rebalance

See [UPDATE_V082.md](UPDATE_V082.md) for the new 3PT rating-to-accuracy brackets and the standard, elite (95–99), and perfect (100) distance-penalty schedules. These apply to **every offensive strategy** and preserve fatigue, positional and defensive effects.

## v0.8.3 — height-based contests and interior blocks

See [UPDATE_V083.md](UPDATE_V083.md) for height-adjusted three-point, mid-range, layup and dunk contests, plus modest interior block modifiers. The update preserves v0.8.2 three-point balancing and prevents the old Pure Chaos height bonus from stacking twice.

## v0.8.4 — fatigue rebalance and player-controlled substitutions

See [UPDATE_V084.md](UPDATE_V084.md). Shooting fatigue caps at 18%, finishing at 12% and defense at 10%; playmaking remains unaffected. Timeouts restore +4 energy for both on-court teams, voluntary subs are timeout-only (with forced foul-out replacements preserved), and the small fatigue emoji now appears in the top-right of player circles at below 60% / below 25% energy. No new energy bars in the substitution UI.

## v0.9 — admin appearance editor

See [UPDATE_V09.md](UPDATE_V09.md). The main-menu-only blue lock opens a server-verified admin panel that sorts the live roster by OVR and edits the exact 44px on-court headshot crops while leaving full-body art and all gameplay data unchanged. Crop backups can be exported and imported, since free Render has ephemeral storage.

## v0.9.1 — automatic $1 opening bid

See [UPDATE_V091.md](UPDATE_V091.md). Every normal auction now begins with a $1 bid automatically placed by the designated opener. Their opponent acts first; passing or timing out awards the opener that player for $1. Higher bids, alternating openers and free-selection cases work as before.
