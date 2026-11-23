# Court Cash V0.8.41 — Homepage Art and Narrower Cards

This is a presentation-only update to the **main menu**. No game mechanics, player data, shooting, fatigue, or substitution logic changed.

## Desktop homepage

- The Create a Room and Join Your Friend cards are now centered in a **656px-wide two-column layout**, approximately two-thirds of their original combined width.
- On the **left**, the original player in the black tank top, black headband and purple basketball pants appears without his beige background.
- On the **right**, the original smiling afro-haired player in black and yellow appears spinning a basketball, again without the beige background.
- The two original illustrations were isolated and compressed into transparent AVIF assets:
  - `public/home-left.avif`
  - `public/home-right.avif`
- Both player images are decorative only; the original room forms remain genuine, keyboard-accessible, functional HTML inputs and submit buttons.
- The previously considered creepy peeking head **is not present**.
- Page title, lime/blue palette, hero headline, tagline, and footer note remain unchanged.

## Responsive behavior

- On wide desktop screens, both characters flank the headline and forms, reaching the bottom edge of the viewport as shown in the approved reference.
- On narrower desktop widths, character images scale with the viewport and become slightly subdued to protect form legibility.
- At 990px and below, the cards stack into one column, and decorative side characters are hidden to keep touch controls usable.
- Artwork is only inside the `#welcome` section and disappears when players join a game.

## Compatibility and QA

- `server.js` recognizes `.avif` and serves it as `image/avif`.
- The project version and page header read **0.8.41**.
- `test/v0841-home.test.js` covers asset references and signatures, original input/form IDs, image-only homepage scope, smaller card layout, responsive rules and version.

