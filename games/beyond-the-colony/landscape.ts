const TAU = Math.PI * 2;
export const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));
const grain = (n: number): number => {
  const v = Math.sin(n * 91.73 + 3.13) * 41937.19;
  return v - Math.floor(v);
};

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}

export function polygon(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill: string): void {
  ctx.fillStyle = fill; ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath(); ctx.fill();
}

export function sky(ctx: CanvasRenderingContext2D, time: number, journey: number, reduced: boolean): void {
  const bg = ctx.createLinearGradient(0, 0, 0, 540);
  bg.addColorStop(0, '#061724'); bg.addColorStop(0.56, '#164655'); bg.addColorStop(1, '#376376');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 960, 540);
  for (let i = 0; i < 72; i += 1) {
    const a = reduced ? 0.65 : 0.35 + 0.3 * (1 + Math.sin(time * 0.35 + i));
    ellipse(ctx, 26 + grain(i + 2) * 908, 30 + grain(i + 87) * 248, i % 13 === 0 ? 1.35 : 0.7, i % 13 === 0 ? 1.35 : 0.7, `rgba(216,251,237,${a})`);
  }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const gradient = ctx.createLinearGradient(0, 50, 0, 245);
    gradient.addColorStop(0, 'rgba(115,242,174,0)');
    gradient.addColorStop(0.45, `rgba(75,225,171,${0.07 + ribbon * 0.025})`);
    gradient.addColorStop(0.75, `rgba(75,225,171,${0.18 - ribbon * 0.04})`);
    gradient.addColorStop(1, 'rgba(92,237,217,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (let x = -40; x <= 1000; x += 16) {
      const y = 100 + ribbon * 28 + Math.sin(x / 194 + time * 0.09 + ribbon) * 43 + Math.sin(x / 82 - time * 0.045) * 15;
      if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = 1000; x >= -40; x -= 16) {
      const y = 160 + ribbon * 27 + Math.sin(x / 194 + time * 0.09 + ribbon) * 43 + Math.sin(x / 82 - time * 0.045) * 15;
      ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const moon = ctx.createRadialGradient(634, 110, 2, 634, 110, 48);
  moon.addColorStop(0, 'rgba(221,253,230,0.17)'); moon.addColorStop(1, 'rgba(221,253,230,0)');
  ctx.fillStyle = moon; ctx.fillRect(585, 61, 98, 98);
  ellipse(ctx, 634, 110, 11, 11, '#d8ede1');
  ellipse(ctx, 638, 106, 10, 10, '#10323d');

  for (let layer = 0; layer < 3; layer += 1) {
    const base = 360 + layer * 47;
    const shift = reduced ? 0 : Math.sin(journey * 0.14) * (layer + 1) * 16;
    const peaks: [number, number][] = [[-100, base]];
    for (let i = -1; i < 10; i += 1) {
      const x = i * 150 + shift;
      const top = base - (90 + grain(i + layer * 13) * 130);
      peaks.push([x, base - 30], [x + 70, top], [x + 150, base - 18]);
    }
    peaks.push([1100, 540], [-100, 540]);
    polygon(ctx, peaks, ['#295666', '#235064', '#173c52'][layer]!);
    for (let i = -1; i < 10; i += 1) {
      const x = i * 150 + shift;
      const top = base - (90 + grain(i + layer * 13) * 130);
      polygon(ctx, [[x + 70, top], [x + 91, top + 44], [x + 72, top + 33], [x + 58, top + 45], [x + 49, top + 41]], ['#b2d8d7', '#87bcc9', '#477b90'][layer]!);
      polygon(ctx, [[x + 70, top], [x + 90, top + 60], [x + 150, base - 18], [x + 89, base]], ['#20495d', '#1b4056', '#123347'][layer]!);
    }
  }
  // A fixed summit gives the ascending foreground a distant destination.
  polygon(ctx, [[594, 351], [785, 163], [890, 300], [984, 357]], '#427789');
  polygon(ctx, [[785, 163], [798, 236], [880, 327], [738, 283]], '#245169');
  polygon(ctx, [[724, 224], [785, 163], [825, 215], [802, 207], [790, 227], [776, 211], [759, 232], [753, 218]], '#c4e9e5');
  ctx.strokeStyle = 'rgba(178,222,215,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(785, 153); ctx.lineTo(785, 139); ctx.stroke();
  polygon(ctx, [[786, 139], [804, 144], [786, 149]], '#efb483');
}

export function shelf(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, depth: number, broken = false): void {
  const half = width / 2;
  polygon(ctx, [[x - half, y + 8], [x + half, y + 5], [x + half - 20, y + depth * 0.65], [x + width * 0.12, y + depth], [x - width * 0.24, y + depth * 0.7]], '#1b5976');
  polygon(ctx, [[x - half, y + 7], [x - 8, y + 14], [x + width * 0.12, y + depth], [x - width * 0.24, y + depth * 0.7]], '#277590');
  polygon(ctx, [[x + 7, y + 13], [x + half, y + 5], [x + half - 20, y + depth * 0.65]], '#194459');
  polygon(ctx, [[x - half - 4, y + 1], [x - half + 18, y - 7], [x + 6, y - 4], [x + half - 19, y - 10], [x + half + 7, y - 1], [x + half, y + 9], [x - 3, y + 15], [x - half, y + 12]], '#bfe6e7');
  polygon(ctx, [[x - half - 4, y + 1], [x - half + 18, y - 7], [x + 6, y - 4], [x + half - 19, y - 10], [x + half + 7, y - 1], [x + 10, y + 4]], '#eefaf0');
  ctx.strokeStyle = 'rgba(154,237,243,0.38)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const sx = x - half + 22 + i * width * 0.19;
    ctx.beginPath(); ctx.moveTo(sx, y + 19); ctx.lineTo(sx + 9, y + depth * (0.25 + i * 0.035)); ctx.stroke();
  }
  if (broken) {
    ctx.strokeStyle = '#0a3045'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 19, y - 3); ctx.lineTo(x + 2, y + 3); ctx.lineTo(x - 8, y + 13); ctx.lineTo(x + 20, y + 35); ctx.stroke();
  }
}

export function refuge(ctx: CanvasRenderingContext2D, time: number, occupied: boolean, reduced: boolean): void {
  polygon(ctx, [[708, 307], [778, 276], [900, 284], [951, 322], [900, 443], [800, 423]], '#13374a');
  polygon(ctx, [[708, 307], [778, 276], [900, 284], [925, 302], [790, 316]], '#d5eae2');
  const glow = ctx.createRadialGradient(822, 279, 4, 822, 279, occupied ? 110 : 65);
  glow.addColorStop(0, occupied ? 'rgba(255,213,124,.24)' : 'rgba(255,213,124,.08)');
  glow.addColorStop(1, 'rgba(255,213,124,0)');
  ctx.fillStyle = glow; ctx.fillRect(710, 168, 224, 224);
  polygon(ctx, [[773, 293], [820, 227], [867, 292]], '#dd885d');
  polygon(ctx, [[820, 227], [894, 272], [867, 292]], '#854956');
  polygon(ctx, [[797, 293], [820, 246], [841, 293]], occupied ? '#ffe7a2' : '#f3cb85');
  polygon(ctx, [[820, 246], [826, 290], [841, 293]], '#bc7754');
  ctx.strokeStyle = '#f6ddb4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(820, 227); ctx.lineTo(773, 293); ctx.moveTo(820, 227); ctx.lineTo(867, 292); ctx.stroke();
  ctx.strokeStyle = '#95bcc0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(794, 267); ctx.lineTo(751, 306); ctx.moveTo(867, 270); ctx.lineTo(909, 307); ctx.stroke();
  ctx.fillStyle = '#0b2c3d'; ctx.fillRect(885, 247, 3, 40);
  const flag = reduced ? 0 : Math.sin(time * 2.8) * 3;
  polygon(ctx, [[888, 247], [909, 251 + flag], [900, 259 + flag], [888, 259]], '#edc795');
  ctx.fillStyle = '#daede4'; ctx.font = '600 10px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillText('REFUGE', 840, 326);
}

export function colony(ctx: CanvasRenderingContext2D, journey: number): void {
  const scale = 0.68 + 0.32 / (1 + journey * 0.1);
  ctx.save(); ctx.translate(118, 449); ctx.scale(scale, scale);
  polygon(ctx, [[-128, 10], [-69, -20], [25, -18], [97, 4], [61, 26], [-64, 30]], '#6697a9');
  polygon(ctx, [[-128, 10], [-69, -20], [25, -18], [97, 4], [11, 14], [-88, 16]], '#b9d5d6');
  for (let i = 0; i < 12; i += 1) {
    const x = -82 + i * 12;
    const y = -8 + Math.sin(i * 2.1) * 7;
    ellipse(ctx, x, y - 10, 5.3, 10, '#102a3b');
    ellipse(ctx, x + 1, y - 7, 2.9, 6, '#deece7');
    ellipse(ctx, x + 2, y - 17, 1, 1, '#eec592');
  }
  ctx.restore();
}

export function flurries(ctx: CanvasRenderingContext2D, time: number, tension: number): void {
  for (let i = 0; i < 38; i += 1) {
    const x = ((grain(i + 201) * 1080 - time * (10 + tension * 20 + grain(i) * 15)) % 1080 + 1080) % 1080 - 60;
    const y = (grain(i + 61) * 570 + time * (5 + grain(i + 32) * 11)) % 570 - 15;
    const size = 0.7 + grain(i + 12) * 1.6;
    ellipse(ctx, x, y, size, size * 0.7, 'rgba(228,250,244,0.48)');
  }
}

export function snowPuff(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  if (age < 0 || age > 1.1) return;
  for (let i = 0; i < 17; i += 1) {
    const angle = Math.PI + i / 16 * Math.PI;
    const speed = 18 + grain(i + 481) * 55;
    const spread = age * speed;
    ctx.globalAlpha = clamp(1 - age / 1.1);
    ellipse(ctx, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread + age * age * 35, 5 + grain(i + 48) * 9 + age * 9, 5 + age * 9, '#e1f5ed');
  }
  ctx.globalAlpha = 1;
}
