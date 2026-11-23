# COURT CASH v0.5.1 — Four courts + connected 3-point lines

## Four equally likely courts

Each **game** independently chooses one court on the **server**. Each is exactly
25% likely, and the selection is transmitted with `game.courtStyle` in the
normal synchronized game state. Both users see the same court throughout that
game. A best-of-seven series rolls again when the next game begins, not every
possession, animation frame, refresh, or timeout.

| Court style ID | Design |
| --- | --- |
| `midnight-stars` | Black floor, white linework, 11 scattered white cartoon-style stars |
| `dark-brown` | Dark brown hardwood/planks, black linework |
| `blue-sky` | Dark blue in-bounds floor, white linework, sky-blue painted keys and sky-blue out-of-bounds area |
| `whiteout` | White floor, black linework |

**The 25% odds are not displayed to players.**

## Three-point line repair

The former disconnected, misplaced semi-arcs were replaced with full connected
paths for **both baskets**, consisting of two straight corner-three segments
and a circular arc toward center court. The arc is a ~23-ft-9-in radius around
the basket, with corner lanes ~3 ft from the sidelines, and the baskets are
aligned relative to the baselines. The ball and shooter now aim at these
corrected rim positions.

## Files and regression checks

- `court-styles.js`: authoritative equal-probability picker, rolled once in
  `startGame()` in `server.js`.
- `public/court-designs.js`: all four palettes, cartoon stars, painted keys,
  bounds, basket geometry, and shared connected 3PT path renderer.
- `public/app.js`: draws the server-chosen style each frame and aligns shot
  visuals with the corrected rim position.
- `public/index.html`: loads the court renderer before the main client script.
- `test/court-designs.test.js`: verifies exact 25% probability partitions,
  line continuity and both arc intersections, and all four color designs.
- `test/game.test.js`: checks both clients receive the same style and handles
  a legitimate mandatory foul-out substitution in the fast integration test.

This is a court-presentation update only. Draft, strategies, statistical
probabilities, custom player backup, and face-only on-court portrait settings
are unchanged. The separately backed-up 83 custom players have not yet been
imported into the currently deployed game roster.
