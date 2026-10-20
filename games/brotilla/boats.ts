import { captain, crew } from './cast';
import { box, clamp, ease, label, line, mix, oval, poly, type Ctx } from './ink';
import type { Layout } from './layout';
import type { Frame } from './presentation';
import type { Production } from './production';
import { camera, fan, flag, medal, moraleCase, ring, teleprompter } from './props';
import { wake } from './sea';

export const appears = (f: Frame, at: number) => ease(Math.log(Math.max(100, f.currentX100) / at) / .13);
export function captainPlatform(f: Frame, p: Production) {
  return 15 * appears(f, 300) + 16 * p.weights.centre;
}
function hull(c: Ctx, name: string) {
  poly(c, [-4, 0, 523, -4, 489, 46, 431, 65, 70, 66, 20, 44], '#244959', '#0c2938');
  poly(c, [12, 12, 506, 7, 481, 33, 422, 50, 75, 51, 34, 36], '#355e68');
  line(c, [6, 2, 518, -2], '#f4d699', 6);
  line(c, [45, 38, 470, 33], '#dc8866', 5);
  poly(c, [81, 54, 427, 53, 475, 38, 444, 62, 72, 65], '#172e45');
  for (let x = 71; x < 380; x += 58) { oval(c, x, 18, 10, 10, '#092f41', '#aa9a71'); oval(c, x - 3, 16, 3, 3, '#679d9d'); }
  label(c, name, 412, 18, 19, '#f6dca7', 145, 'center', 'Georgia');
  line(c, [456, -1, 468, 27, 477, 28], '#1a3040', 2);
}

export function flagship(c: Ctx, f: Frame, p: Production, l: Layout, t: number) {
  const { shipX: x, shipY: y, shipScale: s } = l;
  const down = f.phase === 'crashed' ? ease((f.outcomeAge - .5) / .9) : 0;
  const rock = Math.sin(t * 1.15) * .012;
  wake(c, x + 235 * s, y + 60 * s, 257 * s, t);
  c.save(); c.translate(x, y + Math.sin(t * 1.8) * 3); c.scale(s, s); c.rotate(rock);
  // Rails, stern cabin, sail rigging and production equipment are deck-local.
  line(c, [17, 0, 17, -33, 479, -33, 479, -2], '#e5d1a1', 3);
  for (let i = 0; i < 9; i++) line(c, [28 + i * 55, -33, 28 + i * 55, 0], '#aec3ad', 2);
  poly(c, [9, -2, 16, -77, 127, -77, 151, -2], '#e4d7ad', '#153644');
  poly(c, [14, -79, 130, -79, 141, -69, 6, -69], '#164c58', '#153644');
  box(c, 29, -61, 83, 36, '#2c6672', '#254654', 3);
  line(c, [71, -61, 71, -25], '#b4cfb5', 3);
  line(c, [32, -53, 52, -53, 64, -35], '#86b1a6', 2);
  label(c, 'ALL EYES ON ME', 74, -14, 8, '#3a4f4c', 117);
  // A working sailor remains grounded amid the media circus.
  c.save(); c.translate(63, -36); c.scale(.65, .65); crew(c, 'sailor', t + 4); c.restore();
  c.save(); c.translate(164, -3); c.scale(.88, .88); crew(c, 'director', t + 1, down * .3); c.restore();
  fan(c, 219, -4, f.phase === 'crashed' ? f.elapsed + (1 - Math.exp(-f.outcomeAge * 5)) / 5 : t, down);
  camera(c, 111, -46, t, down * .22);
  const screen = appears(f, 160);
  if (screen > 0) { c.save(); c.globalAlpha = screen; teleprompter(c, 274, -5, t); c.restore(); }
  const halo = appears(f, 125) * (.55 + p.weights.live * .45);
  if (halo > 0) { c.save(); c.globalAlpha = halo; ring(c, 315, -3, down); c.restore(); }
  // The hero's boots, box and flag all rise with her absurd self-centring podium.
  const elevation = captainPlatform(f, p);
  box(c, 318, -elevation, 155, elevation + 4, '#d4ae64', '#173846', 2);
  if (elevation > 8) label(c, 'COLLECTIVE EGO', 395, -elevation / 2 + 2, 8, '#55452d', 133);
  c.save(); c.translate(376, -elevation);
  flag(c, -57, t, down);
  captain(c, t, f, p);
  c.restore();
  // A paid heroic portrait shows up before the floating awards ceremony.
  const portrait = appears(f, 200);
  if (portrait > 0) {
    c.save(); c.globalAlpha = portrait; c.translate(203, -51); c.rotate(-.07 + Math.sin(t) * .015);
    box(c, -29, -38, 58, 77, '#c59348', '#173641', 2);
    box(c, -24, -33, 48, 66, '#d6ac79', '#f3d795', 1);
    oval(c, 0, -15, 11, 14, '#93643c'); oval(c, 2, -12, 9, 11, '#f2c39b');
    poly(c, [-12, 3, 12, 2, 20, 29, -19, 29], '#f1c44a', '#826132');
    line(c, [-17, 22, -17, -27, -35, -23], '#557b6b', 3);
    label(c, 'VERY HUMBLE', 0, 34, 4, '#49362f', 47);
    c.restore();
  }
  hull(c, 'BROTILLA');
  // Taut safety rope and life ring make the deck read as a boat, not a platform.
  for (let i = 0; i < 5; i++) {
    c.beginPath(); c.moveTo(22 + i * 85, 5); c.quadraticCurveTo(65 + i * 85, 18, 107 + i * 85, 5);
    c.strokeStyle = '#c8b380'; c.lineWidth = 2; c.stroke();
  }
  oval(c, 176, 29, 19, 20, '#e69b6e', '#162f40'); oval(c, 176, 29, 10, 11, '#244b5c', '#162f40');
  for (const sign of [-1, 1]) line(c, [176 + sign * 10, 14, 176 + sign * 5, 21], '#f9dfb0', 6);
  c.restore();
}

export function partyBoat(c: Ctx, f: Frame, l: Layout, t: number) {
  const { partyX: x, partyY: y, partyScale: s } = l;
  const end = f.phase === 'crashed', down = end ? ease((f.outcomeAge - .35) / .8) : 0;
  const age = end ? f.outcomeAge : null;
  wake(c, x + 126 * s, y + 40 * s, 143 * s, t, .8);
  c.save(); c.translate(x, y + Math.sin(t * 1.7 + 2) * 3); c.scale(s, s); c.rotate(Math.sin(t * 1.3 + 2) * .016);
  // The original supporting cast's entire drug subplot stays on this separate boat.
  line(c, [5, -4, 5, -133, 265, -133, 265, 0], '#2d414b', 4);
  poly(c, [0, -138, 269, -138, 278, -119, -10, -119], '#e99193', '#433f4e');
  label(c, 'FICTIONAL ENTOURAGE · AFTERPARTY', 134, -129, 8, '#422d46', 251);
  for (let i = 0; i < 10; i++) oval(c, 9 + i * 27, -111 + Math.sin(i * .35) * 7, 3.5, 4, down > .8 ? '#7e7972' : i % 2 ? '#f8e59c' : '#9de1b9');
  c.save(); c.translate(66, -1); c.scale(.92, .92); crew(c, 'dj', t * 1.1, down); c.restore();
  c.save(); c.translate(229, -2); c.scale(.9, .9); crew(c, 'bro', t + 2, down * .8); c.restore();
  // DJ mixer, little waveform and two turntables. No instructions for drug use.
  box(c, 19, -34, 103, 33, '#223448', '#f1c077', 2);
  oval(c, 43, -26, 16, 6, '#1a2134', '#7ba8a4'); oval(c, 100, -26, 16, 6, '#1a2134', '#7ba8a4');
  for (let i = 0; i < 5; i++) box(c, 66 + i * 5, -21, 3, (4 + Math.sin(t * 6 + i) * 3) * (1 - down) + 1, down > .7 ? '#5f6b68' : '#85e7c5');
  label(c, down > .8 ? 'AUX OUT' : 'DJ DIALECTIC', 72, -9, 8, down > .8 ? '#f29487' : '#e9d5a3', 92);
  moraleCase(c, 168, -4, age);
  poly(c, [-12, 0, 287, 0, 259, 45, 29, 45], '#b47676', '#203a49');
  poly(c, [-5, 8, 280, 8, 265, 27, 21, 27], '#d59a8d');
  line(c, [10, 2, 278, 2], '#f8d9a8', 5);
  label(c, 'SEAS THE MEANS', 142, 22, 17, '#462f43', 238, 'center', 'Georgia');
  label(c, 'ETHICALLY SOURCED MAIN-CHARACTER ENERGY', 142, 37, 5.5, '#eeddba', 245);
  c.restore();
}

export function awards(c: Ctx, f: Frame, l: Layout, t: number) {
  const collapse = f.phase === 'crashed' ? ease((f.outcomeAge - .65) / 1.7) : 0;
  medal(c, l.portrait ? 466 : 825, l.portrait ? 207 : 170, t, collapse, appears(f, 800));
  const ceremony = appears(f, 1200);
  if (ceremony > 0) {
    c.save(); c.globalAlpha = ceremony;
    const x = l.portrait ? 346 : 706, y = l.portrait ? 308 : 265;
    c.translate(x, y + collapse * 10);
    line(c, [-110, 24, -110, -38, 119, -38, 119, 20], '#c7af72', 3);
    c.save(); c.rotate(collapse * .08);
    box(c, -119, -48, 250, 33, '#233d4b', '#e1b564', 3);
    label(c, collapse > .9 ? 'AWARDS CEREMONY POSTPONED' : 'THE FIRST ANNUAL ME AWARDS', 6, -32, 10, '#edcc85', 236);
    c.restore();
    c.restore();
  }
}

/** A confirmed cash-out gives the player a separate tender, not an invented win. */
export function escapeBoat(c: Ctx, f: Frame, l: Layout, t: number) {
  if (f.phase !== 'escaped') return;
  const enter = ease(f.outcomeAge / 1.4), depart = ease((f.outcomeAge - 1.4) / 2);
  const s = l.portrait ? 1.05 : 1.03;
  const x = mix(-280, l.portrait ? 89 : 487, enter) + depart * (l.portrait ? 15 : 105);
  const y = l.portrait ? 598 : 388;
  wake(c, x + 140, y + 36, 159, t, 1.4);
  c.save(); c.translate(x, y + Math.sin(t * 2.2) * 2); c.scale(s, s);
  c.save(); c.translate(95, 0); c.scale(.8, .8); crew(c, 'influencer', t + 1); c.restore();
  // Towel is wrapped around the passenger, with the phone hand in front.
  poly(c, [79, -47, 105, -50, 119, -23, 82, -23], '#f0e6ce', '#254651');
  line(c, [84, -43, 99, -30, 108, -44], '#b9b8a1', 3);
  line(c, [26, 0, 26, -76, 240, -76, 240, 0], '#e8d1a1', 3);
  poly(c, [10, -78, 241, -78, 258, -64, -4, -64], '#80c4ac', '#18414c');
  label(c, 'SELF-CARE IS RESISTANCE', 128, -70, 8, '#1b4547', 218);
  poly(c, [-13, 0, 286, 0, 264, 35, 22, 35], '#eadab3', '#173e4f');
  line(c, [0, 10, 278, 10], '#e0896f', 5);
  label(c, 'PERSONAL BOUNDARIES', 141, 24, 12, '#254756', 251, 'center', 'Georgia');
  box(c, -18, -5, 21, 25, '#21384b', '#d2ac74', 3);
  c.restore();
}
