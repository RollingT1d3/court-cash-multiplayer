# Court Cash V0.9.1 — Automatic $1 Opening Bids

## Corrected auction rule

The team assigned to open a wheel spin **automatically places the minimum $1.00 bid** as soon as a normal auction starts. No click is needed from that team. The opponent **acts first** and has 30 seconds to either:

- **Raise**: The first possible raise is $1.50. All increases must be at least $0.50 and use $0.50 increments.
- **Pass**: The opening team immediately wins the player for $1.00.
- **Let the timer expire**: The opening team immediately wins the player for $1.00.

If the opponent raises, the automatic opening team then has 30 seconds to raise again or pass. Every accepted raise restarts the other player's 30-second decision window. Passing or timing out always awards the player to the current high bidder for that standing bid. Bid funds are charged upon awarding the player, not at the start of the auction.

**Normal auctions can no longer end with neither team bidding or both teams passing.** Every normal auction begins with the automatic $1.00 standing offer.

## Other rules remain unchanged

- Opening team alternates every wheel spin, starting with the coin-flip winner.
- Both teams start with $50.00; each drafts 8 players.
- If either team has less than $1.00, the existing free-selection / automatic-award rules apply instead of a normal auction.
- If a team is already full, the remaining team receives the next player automatically for free.
- No changes to player stats, images, wheel weights, gameplay simulation, strategies, or the V0.9 admin editor.
- Production auction decision clock remains 30 seconds. The integration test can shorten the clock using AUCTION_MS without affecting production.

## Verification

Integration test: `test/v091-auto-bid.test.js` covers the automatic $1.00 bid, the opponent acting first, immediate win on opponent pass, win on timeout, bid increment validation, alternating opening bidder, subsequent raises, and correct budget deductions.
