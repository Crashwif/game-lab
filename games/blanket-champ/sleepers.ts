/** Visible characters at either end of the duvet. Everything else stays covered. */
const INK = '#1c1f26';
const SKIN = '#f3dccb';
const PARTNER_SKIN = '#dba082';
const CORAL = '#ed6174';

export interface SleeperPose {
  time: number;
  beat: number;
  tension: number;
  active: boolean;
  finished: boolean;
  rest: number;
}

function pillow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f9f3e7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-46, -17, 92, 37, 13); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#c5bdb9'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-39, -11, 78, 24, 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-42, -12); ctx.lineTo(-32, -4); ctx.moveTo(41, 12); ctx.lineTo(31, 5); ctx.stroke();
  ctx.restore();
}

function sweat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = '#8fe6f5'; ctx.strokeStyle = INK; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(x + size, y, x + size, y + size, x, y + size);
  ctx.bezierCurveTo(x - size, y + size, x - size, y, x, y - size);
  ctx.fill(); ctx.stroke();
}

function head(ctx: CanvasRenderingContext2D, pose: SleeperPose, partner: boolean): void {
  const beat = Math.sin(pose.beat + (partner ? 0.7 : 0));
  const bob = pose.active ? beat * (1.5 + pose.tension * 3) : Math.sin(pose.time * 1.4) * 0.5;
  ctx.save();
  ctx.translate(partner ? 334 : 271, (partner ? 295 : 324) + bob + pose.rest * 7);
  ctx.rotate((partner ? 0.13 : -0.13) + (pose.active ? beat * 0.035 : 0) + pose.rest * (partner ? 0.1 : -0.16));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.8; ctx.strokeStyle = INK;
  const skin = partner ? PARTNER_SKIN : SKIN;
  // A bun and a little hair silhouette distinguish the partner at small sizes.
  if (partner) {
    ctx.fillStyle = '#653d3b';
    ctx.beginPath(); ctx.ellipse(18, -29, 14, 15, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = CORAL; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(9, -25); ctx.lineTo(25, -23); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.roundRect(-12, 23, 26, 25, 8); ctx.fill(); ctx.stroke();
  for (const x of [-28, 28]) {
    ctx.beginPath(); ctx.ellipse(x, 3, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-26, -17); ctx.bezierCurveTo(-24, -39, 24, -39, 27, -16);
  ctx.bezierCurveTo(33, 6, 24, 30, 5, 34);
  ctx.bezierCurveTo(-15, 36, -32, 13, -26, -17);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (partner) {
    ctx.fillStyle = '#653d3b';
    ctx.beginPath(); ctx.moveTo(-27, 2); ctx.bezierCurveTo(-39, -31, -13, -42, 12, -32);
    ctx.quadraticCurveTo(34, -28, 28, -4); ctx.lineTo(18, -19);
    ctx.quadraticCurveTo(-3, -9, -19, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // The champ never takes off the ridiculous red sports headband.
    ctx.fillStyle = '#6b4a36';
    ctx.beginPath(); ctx.moveTo(-23, -24); ctx.lineTo(-18, -37); ctx.lineTo(-7, -31);
    ctx.lineTo(0, -40); ctx.lineTo(10, -32); ctx.lineTo(20, -35); ctx.lineTo(24, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CORAL;
    ctx.beginPath(); ctx.moveTo(-29, -24); ctx.quadraticCurveTo(0, -31, 28, -23);
    ctx.lineTo(29, -12); ctx.quadraticCurveTo(0, -20, -29, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffece5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-23, -20); ctx.quadraticCurveTo(0, -25, 22, -19); ctx.stroke();
    ctx.strokeStyle = INK;
  }
  const exhausted = pose.finished;
  const panic = pose.active && pose.tension > 0.65 && !partner;
  const blink = !pose.active && !exhausted && (pose.time + (partner ? 1.4 : 0)) % 4.5 > 4.32;
  ctx.lineWidth = 2;
  for (const x of [-11, 12]) {
    if (exhausted || blink) {
      ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.quadraticCurveTo(x, exhausted ? 5 : 1, x + 5, 0); ctx.stroke();
    } else {
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.ellipse(x, 0, 8, panic ? 10 : partner ? 5.5 : 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x + (partner ? -3 : 2), 1, panic ? 2 : 2.6, 0, Math.PI * 2); ctx.fill();
      if (partner) {
        ctx.beginPath(); ctx.moveTo(x - 8, -2); ctx.lineTo(x + 7, -2); ctx.stroke();
      }
    }
  }
  // Raised eyebrow / increasing determination, then total battery failure.
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-19, -10 - (partner ? 3 : 0)); ctx.lineTo(-5, -9 + (!partner ? pose.tension * 4 : 0));
  ctx.moveTo(5, -9 + (!partner ? pose.tension * 4 : 0)); ctx.lineTo(19, -10);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(-2, 10); ctx.lineTo(4, 11); ctx.stroke();
  ctx.fillStyle = partner ? 'rgba(187, 77, 77, 0.35)' : `rgba(231, 112, 109, ${0.16 + pose.tension * 0.35})`;
  for (const x of [-20, 21]) { ctx.beginPath(); ctx.ellipse(x, 12, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  if (exhausted && !partner) {
    ctx.fillStyle = '#6f3942'; ctx.ellipse(4, 21, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (panic) {
    ctx.fillStyle = '#fffdf8'; ctx.roundRect(-10, 18, 21, 8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 19); ctx.lineTo(0, 25); ctx.stroke();
  } else {
    ctx.moveTo(-8, 20); ctx.quadraticCurveTo(3, partner ? 21 : 27, 13, partner ? 16 : 18); ctx.stroke();
  }
  if (!partner) {
    ctx.strokeStyle = '#a77d6a'; ctx.lineWidth = 1.2;
    for (const x of [-16, -10, -4, 3, 10, 16]) {
      ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x + 1, 30); ctx.stroke();
    }
    if (pose.active && pose.tension > 0.12) {
      sweat(ctx, 33, -9 + ((pose.time * 1.5) % 1) * 15, 4);
      if (pose.tension > 0.5) sweat(ctx, -36, -7 + ((pose.time * 1.8 + 0.5) % 1) * 16, 3);
    }
  }
  ctx.restore();
}

export function drawSleepers(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  pillow(ctx, 328, 330, -0.13);
  head(ctx, pose, true);
  pillow(ctx, 269, 354, 0.08);
  head(ctx, pose, false);
}

function foot(ctx: CanvasRenderingContext2D, pose: SleeperPose, x: number, y: number, index: number, sock: boolean): void {
  const beat = Math.sin(pose.beat + index * 0.85);
  const kick = pose.active ? Math.max(0, beat) * (3 + pose.tension * 9) : 0;
  ctx.save();
  ctx.translate(x, y - kick + pose.rest * 5);
  ctx.rotate(-0.12 + (pose.active ? beat * (0.07 + pose.tension * 0.12) : 0) + pose.rest * 0.55);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = sock ? CORAL : PARTNER_SKIN;
  // An ankle, heel, arch and an upturned toe: a foot silhouette, not an oval.
  ctx.beginPath(); ctx.moveTo(-36, -5); ctx.lineTo(-12, -5);
  ctx.bezierCurveTo(-7, -12, -9, -26, -3, -32);
  ctx.bezierCurveTo(2, -40, 16, -37, 18, -29);
  ctx.bezierCurveTo(24, -12, 17, 8, 8, 11);
  ctx.quadraticCurveTo(-4, 15, -13, 7); ctx.lineTo(-36, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (sock) {
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#fff3df';
    ctx.fillRect(-30, -10, 5, 24); ctx.fillRect(-21, -10, 5, 24);
    ctx.fillStyle = '#b33859';
    ctx.beginPath(); ctx.ellipse(7, -32, 13, 8, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 7, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    // Five rounded toes, with a larger big toe and short crease lines.
    for (let toe = 4; toe >= 0; toe -= 1) {
      const tx = -3 + toe * 4.5;
      const ty = -31 + toe * 2.3;
      ctx.fillStyle = PARTNER_SKIN; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.ellipse(tx, ty, 4.1 - toe * 0.35, 5.4 - toe * 0.45, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#a96958'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(8, -14); ctx.quadraticCurveTo(3, -4, 4, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-3, 1, 0, 5); ctx.stroke();
  }
  if (pose.active && kick > 6) {
    ctx.strokeStyle = '#fff0c4'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(25, -25); ctx.lineTo(32, -30); ctx.moveTo(28, -15); ctx.lineTo(37, -17); ctx.stroke();
  }
  ctx.restore();
}

export function drawFeet(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  foot(ctx, pose, 645, 326, 0, true);
  foot(ctx, pose, 680, 338, 1, true);
  foot(ctx, pose, 670, 359, 2, false);
  foot(ctx, pose, 711, 371, 3, false);
}

/** A small in-world punchline that leaves the faces unobscured. */
export function drawReaction(ctx: CanvasRenderingContext2D, pose: SleeperPose): void {
  const line = pose.finished ? 'gg. need a nap.' : !pose.active ? 'u ready, champ?' : pose.tension > 0.7 ? 'bro is buffering' : pose.tension > 0.3 ? 'cardio is cardio.' : 'socks stay ON.';
  const width = 150;
  ctx.save();
  ctx.translate(382, 407);
  ctx.fillStyle = '#fff8e9'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(0, 0, width, 30, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 1); ctx.lineTo(5, -10); ctx.lineTo(34, 1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff8e9'; ctx.fillRect(18, 0, 13, 3);
  ctx.fillStyle = INK; ctx.font = '700 14px "Trebuchet MS", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(line, width / 2, 16);
  ctx.restore();
}
