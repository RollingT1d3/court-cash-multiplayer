# COURT CASH 0.4.2 — Weighted homepage phrases

Replace the fixed subtitle beneath **“Draft big. Play bigger.”** with one of 14
user-supplied phrases on each homepage load/refresh. Each phrase's weight is
its exact percentage chance (weights total 100%), including the intentionally
rare 2% strategy tip and 18% free-throw tip. Emoji are native Unicode
characters; the original Discord emoji URLs are not needed.

The heading, all buttons, room creation/join forms and gameplay code are
unchanged. The text is set via `textContent`, preventing phrases from
being rendered as HTML. The selection is client-side and independent for
both visitors; the selected phrase stays in place until a new page load.

To modify wording or odds in the future, edit `public/home-phrases.js`.
Run `npm test` for bracket and DOM checks and all other game tests.
