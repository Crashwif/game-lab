type Point = { x: number; y: number };

/** Solves a two-bone limb with a fixed endpoint and a consistent bend direction. */
export function bendJoint(root: Point, end: Point, upper: number, lower: number, side: number): Point {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * side;
  return { x: root.x + dx / distance * along - dy / distance * bend, y: root.y + dy / distance * along + dx / distance * bend };
}

export function pumpPose(elapsed: number) {
  const cycle = Math.max(0, elapsed) / 1200;
  const compression = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
  return { compression, handleY: 238 + compression * 104, downstroke: cycle % 1 < 0.5 };
}

export function drawPumper(ctx: CanvasRenderingContext2D, elapsed: number, startled: number): void {
  const { compression, handleY } = pumpPose(elapsed);
  const hip = { x: 195 - compression * 12 - startled * 12, y: 307 + compression * 18 };
  const shoulder = { x: 220 + compression * 32 - startled * 24, y: 202 + compression * 59 };
  const skin = '#eab28b';
  const ink = '#203b48';
  function segment(a: Point, b: Point, width: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function disc(p: Point, radius: number, color: string) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
  }
  function limb(root: Point, end: Point, a: number, b: number, side: number, width: number, color: string) {
    const joint = bendJoint(root, end, a, b, side);
    segment(root, joint, width + 4, ink); segment(joint, end, width + 4, ink);
    segment(root, joint, width, color); segment(joint, end, width, color);
    return joint;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(28,63,65,.16)';
  ctx.beginPath(); ctx.ellipse(232, 446, 133, 12, 0, 0, Math.PI * 2); ctx.fill();
  const backFoot = { x: 155, y: 425 };
  const frontFoot = { x: 280, y: 425 };
  limb({ x: hip.x - 10, y: hip.y }, backFoot, 72, 73, 1, 26, '#334e65');
  limb({ x: hip.x + 10, y: hip.y }, frontFoot, 78, 78, -1, 29, '#42617b');
  for (const foot of [backFoot, frontFoot]) {
    segment({ x: foot.x - 10, y: 437 }, { x: foot.x + 22, y: 437 }, 19, '#654434');
    segment({ x: foot.x - 13, y: 446 }, { x: foot.x + 27, y: 446 }, 5, ink);
  }
  const backShoulder = { x: shoulder.x - 14, y: shoulder.y + 9 };
  const backHand = { x: 300, y: handleY };
  limb(backShoulder, backHand, 69, 72, 1, 17, '#c98f6f');
  segment(hip, shoulder, 67, ink);
  segment(hip, shoulder, 61, '#198d93');
  segment({ x: hip.x + 17, y: hip.y - 7 }, { x: shoulder.x + 17, y: shoulder.y + 13 }, 8, '#35afb1');
  segment({ x: hip.x - 22, y: hip.y + 8 }, { x: hip.x + 23, y: hip.y + 8 }, 10, '#263f54');
  const head = { x: shoulder.x + 7, y: shoulder.y - 49 };
  segment(shoulder, head, 23, skin);
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(compression * 0.16 - startled * 0.3);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#42342e';
  ctx.beginPath(); ctx.ellipse(-5, -21, 27, 19, -0.15, Math.PI * 0.7, Math.PI * 2.1); ctx.fill();
  disc({ x: -22, y: 4 }, 8, '#d89978');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(23, -2); ctx.lineTo(35, 8); ctx.lineTo(23, 13); ctx.fill();
  disc({ x: 17, y: -6 }, startled > 0.1 ? 4 : 2.8, ink);
  segment({ x: 11, y: -16 }, { x: 22, y: -14 - startled * 6 }, 3, '#42342e');
  if (startled > 0.1) disc({ x: 20, y: 22 }, 6, ink);
  else segment({ x: 15, y: 22 }, { x: 25, y: 19 }, 2, ink);
  ctx.restore();

  // The piston shares its position with both hand targets.
  segment({ x: 320, y: 419 }, { x: 320, y: handleY }, 9, '#b5cbd0');
  segment({ x: 318, y: 416 }, { x: 318, y: handleY }, 2, '#f2ffff');
  const barrel = ctx.createLinearGradient(305, 0, 335, 0);
  barrel.addColorStop(0, '#a92c3a'); barrel.addColorStop(0.45, '#f06565'); barrel.addColorStop(1, '#cb394c');
  ctx.fillStyle = barrel; ctx.beginPath(); ctx.roundRect(305, 352, 30, 82, 6); ctx.fill();
  segment({ x: 288, y: 439 }, { x: 352, y: 439 }, 12, ink);
  segment({ x: 286, y: handleY }, { x: 354, y: handleY }, 13, ink);
  const frontShoulder = { x: shoulder.x + 13, y: shoulder.y + 3 };
  const frontHand = { x: 340, y: handleY };
  const elbow = limb(frontShoulder, frontHand, 70, 73, 1, 19, skin);
  segment(frontShoulder, { x: frontShoulder.x + (elbow.x - frontShoulder.x) * 0.38, y: frontShoulder.y + (elbow.y - frontShoulder.y) * 0.38 }, 28, '#157c85');
  disc(backHand, 9, '#c98f6f'); disc(frontHand, 10, skin);
  for (let i = 0; i < 3; i++) segment({ x: 335 + i * 4, y: handleY }, { x: 335 + i * 4, y: handleY + 6 }, 1.5, '#b67e61');
  ctx.restore();
}
