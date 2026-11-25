/* COURT CASH: face-and-hair-only framing for ON-COURT player circles.
 *
 * The auction and detail cards keep the original p.image; roster circles reuse the court crop.
 * For each custom player, optionally configure:
 *   "courtPortrait": {
 *     "image": "/player-headshots/de-vawn.png", // optional dedicated square headshot
 *     "crop": {"centerX": 0.50, "top": 0, "width": 1.0}
 *   }
 * When no separate headshot exists, the circle crops the upper part of p.image.
 * "width" is the fraction of the source image's WIDTH captured as a SQUARE.
 * Widen for large afros, poofy hair, high hairstyles or dreads; move centerX to
 * keep asymmetrical hair fully visible. "top" is the source image height fraction.
 * A dedicated headshot should include the complete face + hairstyle, no torso.
 * Each character must be visually checked at roster integration time; arbitrary
 * illustrations can't be perfectly head-cropped without per-player tuning.
 */
(function (root) {
  'use strict';
  const DEFAULT_CROP = Object.freeze({ centerX: 0.5, top: 0.0, width: 0.48 });
  const isFiniteNumber = n => typeof n === 'number' && Number.isFinite(n);
  const fraction = (n, fallback) => isFiniteNumber(n) && n >= 0 && n <= 1 ? n : fallback;

  function imageSource(player) {
    const headshot = player?.courtPortrait?.image;
    if (typeof headshot === 'string' && headshot.trim()) return headshot.trim();
    const full = player?.image;
    return typeof full === 'string' && full.trim() ? full.trim() : null;
  }

  function cropRect(image, player) {
    const width = image?.naturalWidth;
    const height = image?.naturalHeight;
    if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return null;
    const custom = player?.courtPortrait?.crop;
    // A dedicated already-cropped headshot defaults to the entire image;
    // the fallback full illustration defaults to a tight upper-head crop.
    const dedicated = typeof player?.courtPortrait?.image === 'string' && player.courtPortrait.image.trim();
    const defaults = dedicated ? { ...DEFAULT_CROP, width: 1 } : DEFAULT_CROP;
    const params = custom && typeof custom === 'object' ? custom : defaults;
    const wFraction = fraction(params.width, defaults.width);
    const centerX = fraction(params.centerX, DEFAULT_CROP.centerX);
    const top = fraction(params.top, DEFAULT_CROP.top);
    const size = Math.max(1, Math.min(width * wFraction, width, height));
    const sx = Math.max(0, Math.min(width - size, centerX * width - size / 2));
    const sy = Math.max(0, Math.min(height - size, top * height));
    return { sx, sy, sw: size, sh: size };
  }

  function draw(ctx, image, player, x, y, diameter) {
    const crop = cropRect(image, player);
    if (!crop || !isFiniteNumber(diameter) || diameter <= 0) return false;
    ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh,
      x - diameter / 2, y - diameter / 2, diameter, diameter);
    return true;
  }

  // A transparent canvas is the native drag image, not the entire roster row.
  function drawDragPreview(ctx,image,player,size,side) {
    const center=size/2, inner=size-4;
    ctx.clearRect(0,0,size,size);
    ctx.save();
    ctx.beginPath();ctx.arc(center,center,inner/2,0,Math.PI*2);ctx.clip();
    ctx.fillStyle='#2b3b51';ctx.fillRect(0,0,size,size);
    if(!draw(ctx,image,player,center,center,inner)){
      ctx.fillStyle='#fff';ctx.font='900 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(String(player?.name||'?').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase(),center,center);
    }
    ctx.restore();
    ctx.beginPath();ctx.arc(center,center,center-1,0,Math.PI*2);
    ctx.lineWidth=2;ctx.strokeStyle=side==='red'?'#ff859e':'#7cb7ff';ctx.stroke();
  }

  root.CourtHeadshots = Object.freeze({ DEFAULT_CROP, imageSource, cropRect, draw, drawDragPreview });
})(typeof window === 'undefined' ? globalThis : window);
