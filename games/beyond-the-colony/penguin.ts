import { ellipse, polygon } from './landscape';

export interface PenguinPose {
  x: number;
  y: number;
  stride: number;
  airborne: boolean;
  secure: boolean;
  surprised: boolean;
  time: number;
  reduced: boolean;
  tilt?: number;
  scale?: number;
}

/** The feet, flippers and scarf articulate around the body, with a planted foot on each half stride. */
export function penguin(ctx: CanvasRenderingContext2D, pose: PenguinPose): void {
  const stride = pose.reduced || pose.secure ? 0 : pose.stride;
  const sway = pose.reduced ? 0 : Math.sin(stride) * 0.065;
  const bob = pose.reduced || pose.airborne || pose.secure ? 0 : Math.abs(Math.sin(stride)) * 2.8;
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.scale(pose.scale ?? 1, pose.scale ?? 1);
  ellipse(ctx, 0, 2, 26, 5, 'rgba(3,22,34,.24)');
  ctx.translate(0, -bob); ctx.rotate((pose.tilt ?? 0) + sway);

  const farFlipper = pose.airborne ? -0.82 : -0.2 + Math.sin(stride + Math.PI) * 0.22;
  ctx.save(); ctx.translate(13, -44); ctx.rotate(farFlipper);
  ellipse(ctx, 8, 11, 7, 22, '#0b2637'); ctx.restore();

  const footLift = pose.airborne ? 4 : Math.max(0, Math.sin(stride)) * 4;
  ctx.save(); ctx.translate(9 + Math.cos(stride) * 4, -footLift); ctx.rotate(pose.airborne ? -0.28 : Math.max(0, Math.sin(stride)) * 0.25);
  ellipse(ctx, 0, 0, 12, 4, '#d69156'); ctx.restore();

  // The pack follows the body; its straps and rolled blanket remain legible in silhouette.
  ctx.save(); ctx.translate(-20, -43); ctx.rotate(-0.14);
  ctx.fillStyle = '#466c62'; ctx.beginPath(); ctx.roundRect(-9, -14, 16, 33, 6); ctx.fill();
  ctx.strokeStyle = '#a7bb90'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-5, 16); ctx.moveTo(2, -10); ctx.lineTo(2, 16); ctx.stroke();
  ctx.fillStyle = '#bdba93'; ctx.beginPath(); ctx.roundRect(-11, -19, 20, 9, 4); ctx.fill(); ctx.restore();

  const body = ctx.createLinearGradient(-24, -68, 24, -12);
  body.addColorStop(0, '#1d394a'); body.addColorStop(1, '#061e30');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -37, 25, 34, -0.1, 0, Math.PI * 2); ctx.fill();
  ellipse(ctx, 7, -34, 16, 25, '#e9efe2');
  ellipse(ctx, 0, -69, 21, 22, '#102a3a');
  ellipse(ctx, 9, -68, 13, 16, '#f4f5e7');
  polygon(ctx, [[17, -69], [31, -65], [19, -61]], '#efb370');

  if (pose.secure) {
    ctx.strokeStyle = '#173344'; ctx.lineWidth = 2.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -71); ctx.quadraticCurveTo(13, -74, 16, -71); ctx.stroke();
  } else {
    ellipse(ctx, 13, -71, pose.surprised ? 3 : 2.5, pose.surprised ? 4 : 3, '#102939');
    ellipse(ctx, 13.7, -72, 0.85, 0.85, '#fffdf0');
    ctx.strokeStyle = '#102939'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(8, -79); ctx.lineTo(16, pose.surprised ? -80 : -77); ctx.stroke();
  }
  ellipse(ctx, 17, -63, 3, 1.7, 'rgba(225,143,100,.24)');

  const scarfWind = pose.reduced ? 0 : Math.sin(pose.time * 5.5) * 4;
  polygon(ctx, [[-11, -55], [-30, -57 + scarfWind], [-51, -48 + scarfWind * 0.6], [-35, -47 + scarfWind], [-14, -48]], '#c76159');
  polygon(ctx, [[-10, -54], [-25, -47], [-40, -33 + scarfWind], [-27, -33 + scarfWind], [-5, -48]], '#db806b');
  ctx.strokeStyle = '#eba38b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-35, -49 + scarfWind); ctx.lineTo(-39, -45 + scarfWind); ctx.moveTo(-31, -34 + scarfWind); ctx.lineTo(-30, -30 + scarfWind); ctx.stroke();
  ctx.fillStyle = '#d77363'; ctx.beginPath(); ctx.roundRect(-19, -58, 38, 10, 5); ctx.fill();
  ellipse(ctx, -9, -53, 6, 6, '#eda087');

  ctx.save(); ctx.translate(-14, -45);
  ctx.rotate(pose.airborne ? 0.8 : pose.secure ? -0.45 : 0.18 + Math.sin(stride) * 0.28);
  ellipse(ctx, -2, 13, 8, 23, '#173849');
  ctx.strokeStyle = '#3e6571'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-5, 5); ctx.quadraticCurveTo(-8, 17, -3, 29); ctx.stroke(); ctx.restore();

  const nearLift = pose.airborne ? 5 : Math.max(0, -Math.sin(stride)) * 4;
  ctx.save(); ctx.translate(-9 - Math.cos(stride) * 4, -nearLift); ctx.rotate(pose.airborne ? 0.18 : Math.max(0, -Math.sin(stride)) * 0.3);
  ellipse(ctx, 1, 0, 13, 4.5, '#efb477'); ctx.restore();
  if (pose.secure) {
    ctx.fillStyle = '#e8bc85'; ctx.beginPath(); ctx.roundRect(13, -34, 10, 10, 2); ctx.fill();
    ctx.strokeStyle = '#e8bc85'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(25, -29, 3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }
  ctx.restore();
}
