import { awards, escapeBoat, flagship, partyBoat, appears } from './boats';
import { CHAT, STUNT_COPY } from './content';
import { box, ease, hash, label, line, oval, wrap, type Ctx } from './ink';
import type { Layout } from './layout';
import type { Frame } from './presentation';
import type { Production } from './production';
import { drone } from './props';
import { distantBoat, skyAndSea } from './sea';

function chat(c: Ctx, f: Frame, l: Layout, t: number) {
  const x = 17, y = l.top + 16, width = l.portrait ? 278 : 255;
  if (f.phase === 'crashed') {
    c.save(); c.globalAlpha = ease(f.outcomeAge / .25);
    box(c, x, y, width, 86, '#392c3deb', '#ed997a', 4);
    label(c, 'FICTIONAL PARTY BOAT AUDIT', x + 12, y + 16, 9, '#efc390', width - 24, 'left');
    label(c, 'COCAINE RESERVE: EMPTY', x + 12, y + 38, 14, '#ff9b85', width - 24, 'left');
    label(c, 'UNFOLLOWING THE MATERIAL CONDITIONS', x + 12, y + 61, 7.3, '#dac8ac', width - 24, 'left');
    c.restore(); return;
  }
  if (f.phase === 'escaped') {
    box(c, x, y, width, 86, '#123e46ed', '#c4dcaf', 4);
    label(c, 'STATEMENT FROM YOUR PR TEAM', x + 12, y + 16, 9, '#a8dec1', width - 24, 'left');
    label(c, 'SOLIDARITY LIQUIDATED', x + 12, y + 39, 16, '#f0d599', width - 24, 'left', 'Georgia');
    label(c, 'REPLIES HAVE BEEN TURNED OFF.', x + 12, y + 63, 8, '#bbd3bb', width - 24, 'left');
    return;
  }
  box(c, x, y, width, 86, '#203c4be8', '#e3bf85', 4);
  oval(c, x + 15, y + 14, 3, 3, '#ff8c78');
  label(c, 'LIVE · MAIN CHARACTER CAM', x + 26, y + 15, 9, '#f6d5a4', width - 35, 'left');
  const [name, copy] = CHAT[Math.floor(t / 4.7) % CHAT.length]!;
  label(c, name, x + 12, y + 35, 8, '#91cdb8', width - 24, 'left');
  c.font = '700 10px monospace';
  wrap(c, copy, width - 24).slice(0, 2).forEach((row, i) => label(c, row, x + 12, y + 53 + i * 13, 10, '#eae2c7', width - 24, 'left'));
}

export function drawArt(c: Ctx, f: Frame, p: Production, l: Layout, t: number) {
  skyAndSea(c, l, t);
  if (l.portrait) label(c, 'EUROPE ←   GAZA →   ETA: AFTER THE PODCAST', 20, 219, 8, '#574958', 494, 'left');
  distantBoat(c, l.portrait ? 438 : 891, l.horizon + 48, l.portrait ? .46 : .63, t, 'THE AUDACITY OF BOAT');
  const yacht = appears(f, 500);
  if (yacht > 0) {
    c.save(); c.globalAlpha = yacht;
    distantBoat(c, l.portrait ? 424 : 720, l.portrait ? 355 : 277, l.portrait ? .75 : .84, t + 2, 'YACHT MARX', true);
    const x = l.portrait ? 421 : 727, y = l.portrait ? 326 : 244;
    oval(c, x, y, 22, 7, '#82c7b0', '#344f58');
    oval(c, x + 4, y - 12, 7, 8, '#d8aa83', '#3a4547');
    for (let i = 0; i < 4; i++) oval(c, x - 15 + i * 9, y - ((t * 5 + i * 6) % 15), 1.5, 2, '#d2e5c4');
    c.restore();
  }
  awards(c, f, l, t);
  partyBoat(c, f, l, t);
  flagship(c, f, p, l, t);
  const d = Math.max(appears(f, 125), p.weights.drone);
  if (d > .01) {
    c.save(); c.globalAlpha = d;
    const down = f.phase === 'crashed' ? ease((f.outcomeAge - .7) / 1.6) : 0;
    drone(c, l.w * .62 + Math.sin(t * .83) * 27 + p.weights.drone * 21, l.top + (l.portrait ? 49 : 29) + Math.sin(t * 1.3) * 8 + down * 30, l.portrait ? .62 : .67, t, down);
    c.restore();
  }
  if (p.weights.centre > .02 && f.phase === 'running') {
    const s = l.shipScale, cx = l.shipX + 365 * s, cy = l.shipY - 153 * s;
    c.save(); c.globalAlpha = p.weights.centre * .7;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) line(c, [cx + sx * 46, cy + sy * 67, cx + sx * 61, cy + sy * 67, cx + sx * 61, cy + sy * 52], '#fff1bc', 2);
    label(c, 'COLLECTIVE FOCUS: ME', cx, cy + 84, 7, '#f7e2b1', 143);
    c.restore();
  }
  if (f.phase === 'running') for (let i = 0; i < 9; i++) {
    const a = ((t * .22 + hash(i + 1)) % 1), x = l.w - 25 - hash(i) * 23 + Math.sin(a * 4 + i) * 10;
    const y = l.shipY - 15 - a * 122;
    c.save(); c.globalAlpha = (1 - a) * (.3 + p.weights.live * .6); c.translate(x, y); c.rotate(Math.sin(i + t) * .2);
    label(c, i % 3 ? '♥' : '!', 0, 0, 13 + hash(i) * 9, i % 2 ? '#f6ca91' : '#ee91a3', 30);
    c.restore();
  }
  escapeBoat(c, f, l, t);
  chat(c, f, l, t);
  if (f.phase === 'crashed') {
    c.save(); c.globalAlpha = ease((f.outcomeAge - .7) / .5);
    const y = l.h - l.footer - 52, width = l.portrait ? 494 : 560;
    c.translate(l.w / 2, y); c.rotate(f.phase === 'crashed' ? -.025 : -.015);
    box(c, -width / 2, -16, width, 48, f.phase === 'crashed' ? '#f0b08c' : '#b7dabc', '#153645', 3);
    label(c, f.phase === 'crashed' ? 'SOLIDARITY HAS LEFT THE GROUP CHAT' : 'YOUR EXIT HAS BEEN CONFIRMED', 0, 1, l.portrait ? 14 : 18, '#293946', width - 22, 'center', 'Georgia');
    label(c, f.phase === 'crashed' ? 'CAUSE STILL URGENT. AFTERPARTY CANCELLED.' : 'THE PERSONAL BOUNDARIES IS NOW BOARDING.', 0, 21, 8, '#4d5551', width - 22);
    c.restore();
  } else if (f.phase !== 'escaped') {
    const x = l.portrait ? 20 : 24, y = l.h - l.footer - 17;
    box(c, x, y - 13, l.portrait ? 500 : 325, 27, '#173b4ae8', '#789e97', 3);
    label(c, (p.choice === 'auto' ? 'AUTO PUBLICITY · ' : 'YOUR DIRECTION · ') + STUNT_COPY[p.active][0], x + 11, y, l.portrait ? 9 : 8, '#e5d7b1', l.portrait ? 478 : 304, 'left');
  }
  const vignette = c.createLinearGradient(0, 0, l.w, 0);
  vignette.addColorStop(0, '#143b3f28'); vignette.addColorStop(.12, '#143b3f00'); vignette.addColorStop(.88, '#143b3f00'); vignette.addColorStop(1, '#143b3f28');
  c.fillStyle = vignette; c.fillRect(0, l.top, l.w, l.h - l.top - l.footer);
}
