import { drawPumper, pumpPose } from './pumper';
export interface SceneView { phase: 'waiting' | 'betting' | 'running' | 'crashed'; currentX100: number; elapsed: number; crashAge: number }
export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView): void {
  const { currentX100, elapsed, phase, crashAge } = view;
  const props = { phase, skin: { colors: { curve: "#F97393", crash: "#EA4C89", text: "#184D5B", accent: "#F9C74F" } }, overlay: true, caption: "", markers: [] as { hit?: boolean; label: string }[] };
  const stoppedElapsed = elapsed;
  const crashedAt = Date.now() - crashAge;
  const { colors } = props.skin;
  const crashed = props.phase === 'crashed';
  const growth = Math.log2(Math.max(1, currentX100 / 100));
  const radius = 58 + 120 * (1 - Math.exp(-growth / 2));
  const balloonX = 704;
  const knotY = 408;
  const balloonY = knotY - radius - 12;
  const poseTime = props.phase === 'running' ? elapsed : props.phase === 'crashed' ? stoppedElapsed : 0;

  const backdrop: HTMLImageElement | null = null as HTMLImageElement | null;
  if (backdrop) {
    const scale = Math.max(960 / backdrop.naturalWidth, 540 / backdrop.naturalHeight);
    ctx.globalAlpha = 0.42;
    ctx.drawImage(backdrop, (960 - backdrop.naturalWidth * scale) / 2, (540 - backdrop.naturalHeight * scale) / 2, backdrop.naturalWidth * scale, backdrop.naturalHeight * scale);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const [x, y, w] of [[100, 90, 92], [485, 80, 120], [850, 145, 80]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, w, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#a7d6bc';
  ctx.beginPath();
  ctx.moveTo(0, 446);
  ctx.quadraticCurveTo(450, 416, 960, 455);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.fill();
  ctx.fillStyle = '#75a995';
  ctx.fillRect(0, 447, 960, 5);

  ctx.strokeStyle = '#42596a';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(320, 429);
  ctx.bezierCurveTo(405, 508, 560, 496, balloonX, knotY);
  ctx.stroke();
  ctx.strokeStyle = '#9bb3ba';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (props.phase === 'running' && pumpPose(elapsed).downstroke) {
    ctx.fillStyle = '#efffff';
    for (let i = 0; i < 4; i += 1) {
      const t = (elapsed / 1100 + i / 4) % 1;
      const back = 1 - t;
      const x = back ** 3 * 320 + 3 * back ** 2 * t * 405 + 3 * back * t ** 2 * 560 + t ** 3 * balloonX;
      const y = back ** 3 * 429 + 3 * back ** 2 * t * 508 + 3 * back * t ** 2 * 496 + t ** 3 * knotY;
      ctx.beginPath();
      ctx.arc(x, y, 5 + i % 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const recoil = crashed ? Math.min(1, (Date.now() - (crashedAt ?? Date.now())) / 160) : 0;
  drawPumper(ctx, poseTime, recoil);

  if (!crashed) {
    const gradient = ctx.createRadialGradient(balloonX - radius * 0.3, balloonY - radius * 0.4, 8, balloonX, balloonY, radius);
    gradient.addColorStop(0, '#fff3f5');
    gradient.addColorStop(0.24, colors.curve);
    gradient.addColorStop(1, colors.crash);
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(99, 43, 67, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(balloonX, balloonY, radius * 0.86, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.curve;
    ctx.beginPath();
    ctx.moveTo(balloonX - 11, knotY - 12);
    ctx.lineTo(balloonX + 11, knotY - 12);
    ctx.lineTo(balloonX, knotY + 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(3, radius * 0.06);
    ctx.beginPath();
    ctx.ellipse(balloonX - radius * 0.27, balloonY - radius * 0.27, radius * 0.13, radius * 0.28, -0.4, 0, Math.PI);
    ctx.stroke();
  } else {
    const age = Math.min(1, Math.max(0, (Date.now() - (crashedAt ?? Date.now())) / 850));
    const effect: HTMLImageElement | null = null as HTMLImageElement | null;
    if (effect) {
      ctx.globalAlpha = 1 - age * 0.45;
      ctx.drawImage(effect, balloonX - 165, balloonY - 165, 330, 330);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = colors.crash;
    ctx.lineWidth = 8;
    for (let i = 0; i < 18; i += 1) {
      const angle = i * 2.399963;
      const distance = radius * 0.4 + age * (90 + (i % 5) * 24);
      const x = balloonX + Math.cos(angle) * distance;
      const y = balloonY + Math.sin(angle) * distance;
      ctx.beginPath();
      ctx.arc(x, y, 9 + (i % 3) * 3, angle, angle + 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = colors.crash;
    ctx.font = '900 88px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POP!', balloonX, balloonY + 28);
  }

  if (props.overlay) {
    ctx.fillStyle = colors.text;
    ctx.font = '800 58px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${(currentX100 / 100).toFixed(2)}×`, 925, 72);
  }
  if (props.caption) {
    ctx.fillStyle = colors.text;
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(props.caption, 925, 102);
  }
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (const [i, marker] of props.markers.slice(0, 3).entries()) {
    ctx.fillStyle = marker.hit ? colors.accent : colors.text;
    ctx.fillText(marker.label, 925, 488 + i * 18);
  }
  ctx.textAlign = 'start';
}
