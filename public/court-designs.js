/* COURT CASH — four court designs + corrected NBA-style three-point line.
 * Called every animation frame with the theme picked by the server for that game.
 * No client-side randomness: both players always see the same court.
 */
(function (root) {
  'use strict';
  const COURT_STYLES = Object.freeze(['midnight-stars', 'dark-brown', 'blue-sky', 'whiteout']);
  const PALETTES = Object.freeze({
    'midnight-stars': Object.freeze({ floor:'#07090d', out:'#07090d', line:'#ffffff', paint:'#07090d', rim:'#f06742' }),
    'dark-brown': Object.freeze({ floor:'#795032', out:'#795032', line:'#090704', paint:'#795032', rim:'#ec6d3e' }),
    'blue-sky': Object.freeze({ floor:'#113a7b', out:'#83ceff', line:'#ffffff', paint:'#83ceff', rim:'#f16a40' }),
    'whiteout': Object.freeze({ floor:'#fcfcfa', out:'#fcfcfa', line:'#080808', paint:'#fcfcfa', rim:'#e76537' })
  });
  const STARS = Object.freeze([
    [0.19,0.18,12,-.2],[0.29,0.72,8,.7],[0.36,0.26,7,.3],
    [0.45,0.83,10,-.4],[0.55,0.18,8,.3],[0.61,0.73,6,.1],
    [0.76,0.23,9,-.2],[0.84,0.77,12,.6],[0.12,0.79,8,.2],
    [0.68,0.53,7,-.5],[0.33,0.48,6,.4]
  ]);
  function starPath(ctx, x, y, outer, rotation) {
    const inner = outer * .48;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rotation - Math.PI/2 + i * Math.PI/5;
      const r = i % 2 ? inner : outer;
      if (i === 0) ctx.moveTo(x + Math.cos(a)*r, y + Math.sin(a)*r);
      else ctx.lineTo(x + Math.cos(a)*r, y + Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Draw a SINGLE CONNECTED path: baseline --> horizontal corner three -->
  // circular arc around the basket --> horizontal opposite corner --> baseline.
  // Court is 94 x 50 ft, drawn at approximately 10 px per foot.
  // NBA dimensions used: rim = 5.25 ft beyond baseline (playable-court edge);
  // corner line = 3 ft from sideline; arc radius = 23 ft 9 in.
  function traceThreePoint(ctx, side, width = 940, height = 500) {
    const scale = width / 94;
    const baselineX = side === 0 ? 17 : width - 17;
    const basketOffset = 17 + 5.25 * scale;
    const basketX = side === 0 ? basketOffset : width - basketOffset;
    const centerY = height / 2;
    const topY = 3*scale, bottomY = height - topY;
    const radius = 23.75*scale;
    const vertical = centerY - topY;
    if (vertical >= radius) throw new Error('Court too narrow for continuous 3-point line');
    const horizontal = Math.sqrt(radius*radius - vertical*vertical);
    const xJoin = side === 0 ? basketX + horizontal : basketX - horizontal;
    const angle = Math.atan2(vertical,horizontal);
    ctx.beginPath();
    ctx.moveTo(baselineX, topY);
    ctx.lineTo(xJoin, topY);
    if (side === 0) ctx.arc(basketX,centerY,radius,-angle,angle,false);
    else ctx.arc(basketX,centerY,radius,-Math.PI+angle,Math.PI-angle,true);
    ctx.lineTo(baselineX,bottomY);
    ctx.stroke();
    return Object.freeze({ baselineX, basketX, centerY, topY, bottomY, radius, xJoin, angle });
  }

  function drawCourt(ctx, style, width = 940, height = 500) {
    const p = PALETTES[style] || PALETTES['dark-brown'];
    const W=width,H=height,margin=17;
    ctx.save();
    // Out-of-bounds is distinctly light sky blue for the requested blue court.
    ctx.fillStyle=p.out;ctx.fillRect(0,0,W,H);
    ctx.fillStyle=p.floor;ctx.fillRect(margin,margin,W-2*margin,H-2*margin);
    if (style==='dark-brown') {
      // Subtle dark-brown planks, keeping all linework black.
      for (let i=0;i<15;i++) {
        ctx.fillStyle=i%2===0?'#815537':'#754b2e';
        const x=margin+(W-2*margin)*i/15;
        ctx.fillRect(x,margin,(W-2*margin)/15,H-2*margin);
      }
    }
    if (style==='midnight-stars') {
      ctx.fillStyle='#ffffff';
      for (const [x,y,r,rot] of STARS) starPath(ctx,x*W,y*H,r,rot);
    }
    // Paint is sky blue on the blue court; otherwise matches the floor.
    if (style==='blue-sky') {
      ctx.fillStyle=p.paint;
      ctx.fillRect(margin,H/2-94,172,188);
      ctx.fillRect(W-189,H/2-94,172,188);
    }
    ctx.strokeStyle=p.line;ctx.lineWidth=4;
    ctx.strokeRect(margin,margin,W-2*margin,H-2*margin);
    ctx.beginPath();ctx.moveTo(W/2,margin);ctx.lineTo(W/2,H-margin);ctx.stroke();
    ctx.beginPath();ctx.arc(W/2,H/2,67,0,Math.PI*2);ctx.stroke();
    for (let side=0;side<2;side++) {
      const paintX=side===0?margin:W-189;
      const basketX=side===0?margin+5.25*(W/94):W-margin-5.25*(W/94);
      const freeThrowX=side===0?189:W-189;
      ctx.beginPath();ctx.rect(paintX,H/2-94,172,188);ctx.stroke();
      ctx.beginPath();ctx.arc(freeThrowX,H/2,65,0,Math.PI*2);ctx.stroke();
      // The small restricted-area arc under the basket.
      ctx.beginPath();
      ctx.arc(basketX,H/2,40,side===0?-Math.PI/2:Math.PI/2,
        side===0?Math.PI/2:Math.PI*1.5,side===1);
      ctx.stroke();
      traceThreePoint(ctx,side,W,H);
      // Backboard uses each court's line color; rim remains orange.
      const boardX=side===0?margin+4*(W/94):W-margin-4*(W/94);
      ctx.fillStyle=p.line;ctx.fillRect(boardX-3,H/2-19,6,38);
      ctx.beginPath();ctx.strokeStyle=p.rim;ctx.lineWidth=5;
      ctx.arc(basketX,H/2,11,0,Math.PI*2);ctx.stroke();
      ctx.lineWidth=4;ctx.strokeStyle=p.line;
    }
    ctx.restore();
  }
  root.CourtDesigns = Object.freeze({ COURT_STYLES, PALETTES, STARS, traceThreePoint, drawCourt });
})(typeof window === 'undefined' ? globalThis : window);
