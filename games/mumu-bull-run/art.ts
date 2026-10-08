export const INK = '#102c25';
export const CREAM = '#fff6da';
export const GREEN = '#12ac68';
export const GOLD = '#ffc94f';
export const FONT = '"Arial Black", Impact, system-ui, sans-serif';
const TAU = Math.PI * 2;

export function shape(c: CanvasRenderingContext2D, fill: string, width = 4): void {
  c.fillStyle = fill;
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.fill();
  if (width > 0) c.stroke();
}

export function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, width = 4, angle = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
  shape(c, fill, width);
}

export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 8, width = 4): void {
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  shape(c, fill, width);
}

export function text(c: CanvasRenderingContext2D, words: string, x: number, y: number, size: number, fill = INK, align: CanvasTextAlign = 'left', maxWidth?: number): void {
  c.fillStyle = fill;
  c.font = `900 ${size}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(words, x, y, maxWidth);
}

export function star(c: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string, points = 4): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = i * Math.PI / points - Math.PI / 2;
    const r = i % 2 ? radius * 0.36 : radius;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  shape(c, fill, 2);
}

/** Feet alternate planted support and a lifted return, with opposing diagonal pairs. */
function leg(c: CanvasRenderingContext2D, hipX: number, phase: number, running: boolean, near: boolean, bob: number): void {
  const p = ((phase % 1) + 1) % 1;
  const stance = p < 0.62;
  const swing = (p - 0.62) / 0.38;
  const footX = hipX + (running ? (stance ? 27 - 54 * p / 0.62 : -27 + 54 * (0.5 - Math.cos(swing * Math.PI) / 2)) : 4);
  const footY = running && !stance ? -30 * Math.sin(swing * Math.PI) : 0;
  const hipY = -67 + bob;
  const kneeX = hipX + (footX - hipX) * 0.45 + (hipX < 0 ? 13 : -13);
  const kneeY = (hipY + footY) * 0.48;
  c.beginPath();
  c.moveTo(hipX - 12, hipY);
  c.quadraticCurveTo(kneeX - 12, kneeY, footX - 10, footY - 9);
  c.lineTo(footX + 11, footY - 9);
  c.quadraticCurveTo(kneeX + 14, kneeY, hipX + 12, hipY);
  c.closePath();
  shape(c, near ? '#fffdf0' : '#a0b6a4', 4);
  box(c, footX - 14, footY - 13, 29, 15, INK, 5, 3);
  c.strokeStyle = '#4f6959'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(footX + 4, footY - 11); c.lineTo(footX + 5, footY - 1); c.stroke();
}

/** The white bull is an original articulated illustration, drawn in ground coordinates. */
export function bull(c: CanvasRenderingContext2D, x: number, floor: number, scale: number, stride: number, running: boolean, relaxed: boolean, motionTime: number, slope = -0.168): void {
  const bob = running ? -3 - Math.cos(stride * TAU * 2) * 3.4 : Math.sin(motionTime * 1.7) * 1.8;
  c.save(); c.translate(x, floor); c.rotate(slope); c.scale(scale, scale);
  oval(c, 10, 5, 111, 10, '#0c5f4540', 0);
  leg(c, -65, stride + 0.5, running, false, bob);
  leg(c, 62, stride, running, false, bob);
  c.save(); c.translate(0, bob);
  c.strokeStyle = INK; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-87, -87); c.bezierCurveTo(-138, -111, -94, -134, -137, -141 + Math.sin(motionTime * 6) * 8); c.stroke();
  oval(c, -139, -141 + Math.sin(motionTime * 6) * 8, 11, 6, INK, 0, -0.5);
  c.beginPath();
  c.moveTo(-86, -117); c.bezierCurveTo(-112, -90, -91, -48, -52, -46);
  c.bezierCurveTo(-11, -33, 62, -42, 79, -77); c.bezierCurveTo(93, -105, 60, -148, 27, -145);
  c.bezierCurveTo(-4, -134, -51, -142, -86, -117);
  c.closePath(); shape(c, '#fffdf0', 5);
  c.beginPath(); c.moveTo(-79, -75); c.bezierCurveTo(-17, -45, 21, -62, 72, -96); c.bezierCurveTo(61, -39, -55, -25, -79, -75); shape(c, '#d0dfc3', 0);
  c.beginPath(); c.moveTo(-67, -119); c.bezierCurveTo(-35, -134, -2, -125, 7, -133); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.stroke();
  c.restore();
  leg(c, -64, stride, running, true, bob);
  leg(c, 64, stride + 0.5, running, true, bob);
  c.save(); c.translate(0, bob);
  // A trailing scarf shares the body's motion and leaves the face unobstructed.
  c.beginPath(); c.moveTo(60, -109); c.bezierCurveTo(17, -106, -2, -132 + Math.sin(motionTime * 9) * 8, -33, -114);
  c.lineTo(-16, -140); c.lineTo(-33, -153); c.bezierCurveTo(9, -149, 29, -126, 66, -129); c.closePath(); shape(c, GREEN, 4);
  c.beginPath(); c.moveTo(66, -145); c.quadraticCurveTo(53, -174, 35, -163); c.quadraticCurveTo(32, -135, 65, -126); shape(c, CREAM, 4);
  c.beginPath(); c.moveTo(93, -157); c.bezierCurveTo(79, -192, 43, -178, 40, -210);
  c.bezierCurveTo(23, -179, 41, -148, 75, -138); c.closePath(); shape(c, GOLD, 4);
  c.beginPath(); c.moveTo(70, -151); c.bezierCurveTo(78, -174, 128, -171, 141, -142);
  c.bezierCurveTo(153, -114, 139, -86, 105, -82); c.bezierCurveTo(76, -79, 61, -113, 70, -151);
  c.closePath(); shape(c, '#fffdf0', 5);
  c.beginPath(); c.moveTo(115, -156); c.bezierCurveTo(153, -166, 178, -145, 188, -176);
  c.bezierCurveTo(194, -140, 168, -130, 137, -131); c.closePath(); shape(c, GOLD, 4);
  oval(c, 141, -139, 17, 9, '#d0dfc3', 3, 0.2);
  // Heavy brows, a black muzzle and a tooth give the runner a readable expression.
  c.beginPath(); c.moveTo(89, -147); c.lineTo(113, -151); c.strokeStyle = INK; c.lineWidth = 7; c.stroke();
  if (relaxed) {
    c.beginPath(); c.arc(105, -132, 8, Math.PI + 0.3, TAU - 0.3); c.lineWidth = 4; c.stroke();
  } else {
    oval(c, 109, -132, 7, 10, INK, 0);
    oval(c, 112, -135, 2, 3, '#fff', 0);
  }
  oval(c, 126, -104, 38, 26, '#254335', 5, -0.1);
  oval(c, 111, -111, 4, 5, '#071e17', 0);
  oval(c, 143, -114, 4, 5, '#071e17', 0);
  c.strokeStyle = CREAM; c.lineWidth = 3; c.beginPath(); c.moveTo(105, -92); c.quadraticCurveTo(123, -78, 145, -97); c.stroke();
  box(c, 129, -91, 10, 8, '#fffdf0', 2, 0);
  c.beginPath(); c.moveTo(73, -109); c.lineTo(87, -88); c.lineTo(66, -87); c.lineTo(57, -104); c.closePath(); shape(c, GREEN, 3);
  oval(c, 68, -104, 8, 8, GOLD, 3);
  c.restore(); c.restore();
}

export function bear(c: CanvasRenderingContext2D, x: number, ground: number, time: number, crashed: boolean): void {
  c.save(); c.translate(x, ground);
  oval(c, 0, 0, 45, 8, '#0c5f4530', 0);
  box(c, -25, -32, 18, 32, INK, 6, 3);
  box(c, 9, -32, 18, 32, INK, 6, 3);
  oval(c, 0, -44, 35, 40, '#ac7141', 4);
  oval(c, -24, -98, 13, 13, '#895232', 4);
  oval(c, 25, -98, 13, 13, '#895232', 4);
  oval(c, 1, -79, 35, 30, '#bf8750', 4);
  oval(c, 9, -68, 18, 12, '#efd4a1', 3);
  oval(c, 13, -75, 6, 4, INK, 0);
  for (const eye of [-11, 19]) oval(c, eye, -86, 3, 4, INK, 0);
  c.strokeStyle = INK; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-17, -96); c.lineTo(-5, -92); c.moveTo(13, -93); c.lineTo(25, -97); c.stroke();
  c.beginPath(); c.moveTo(-26, -64); c.lineTo(24, -58); c.lineTo(17, -27); c.lineTo(-24, -30); c.closePath(); shape(c, GOLD, 3);
  c.strokeStyle = INK; c.lineWidth = 5;
  c.beginPath(); c.moveTo(-29, -62); c.lineTo(-46, -41); c.lineTo(-55, crashed ? -16 : -39 - Math.sin(time * 1.9) * 4); c.stroke();
  box(c, -68, -16, 24, 16, '#5c7866', 4, 3);
  c.beginPath(); c.moveTo(-56, -17); c.lineTo(crashed ? -72 : -45, crashed ? -23 : -45); c.stroke();
  oval(c, crashed ? -72 : -45, crashed ? -23 : -45, 7, 7, '#ec7659', 3);
  text(c, 'BEAR CREW', 1, -42, 9, INK, 'center', 44);
  c.restore();
}
