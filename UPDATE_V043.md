# COURT CASH v0.4.3 — On-court face + full hairstyle portraits

Court markers now prioritize a **headshot of each player**, not their full-body
character art. This changes **only** the five-on-five on-court animated markers.
The draft portraits, roster images and player detail cards still display the
original full illustration (`player.image`).

When 83 custom players are added, include their original picture in `image`
and optionally tune their on-court framing in `courtPortrait`:

```json
{
  "id": "player-020",
  "image": "/player-images/big-sipper.png",
  "courtPortrait": {
    "crop": { "centerX": 0.5, "top": 0, "width": 0.78 }
  }
}
```

`width` is the fraction of the original **image width** used for a square crop.
`centerX` is the horizontal center as a fraction of source width, and `top` is
the top of the crop as a fraction of source height (all in the 0–1 range).
A higher `width` zooms **out**, making room for big afros, high/poofy styles,
or large dreads. Move `centerX` to frame off-center hair. The default full-art
crop is top-centered and 48% of the artwork width; it is only a starting point.

**Preferred for guaranteed face-and-hair-only art:** supply a separately cropped,
**square** headshot including the entire hair silhouette, with no torso, then
set `courtPortrait.image`. A square image with no `crop` is used whole:

```json
{
  "image": "/player-images/big-sipper.png",
  "courtPortrait": { "image": "/player-headshots/big-sipper.png" }
}
```

If using a non-square dedicated headshot, set its `crop` to frame the full hair
inside the square. No automated face recognition is performed; **each
character with large or unusual hair needs a visual check and potentially a
custom crop/headshot during roster import**. The renderer falls back to initials
when the image is missing or not yet loaded.

Implementation: `public/court-headshots.js`, loaded before `public/app.js` as a
deferred classic script. It calculates safe source rectangles and paints through
the canvas's existing circular clipping path. The game server already sends
entire player objects, so `courtPortrait` fields are passed to both clients
without changing `server.js` or the roster schema. `npm test` exercises these
behaviors and existing gameplay.
