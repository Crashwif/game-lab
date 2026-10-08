import { solveLimb } from './andy';
import { box, clamp, ease, INK, line, oval, shape, text } from './drawing';

const NAVY = '#26314f';
const BADGE = '#f2d04b';

/**
 * Feet planted by distance, not time: through the stance half of a cycle a foot slides back exactly as far as
 * the body walks, so it holds still on the ground; then it swings forward with a lift. `travel` is local px.
 */
export function gait(travel: number, stride: number, offset: number) {
  const u = ((travel / stride + offset) % 1 + 1) % 1;
  if (u < 0.5) return { x: -stride / 4 + u * stride, lift: 0 };
  const s = (u - 0.5) * 2;
  return { x: stride / 4 - ease(s) * stride / 2, lift: Math.sin(Math.PI * s) * 7 };
}

/** An SEC agent in a windbreaker and cap, walking left. `travel` and `stride` are local px; whole steps leave both feet planted. */
function agent(c: CanvasRenderingContext2D, x: number, y: number, travel: number, stride: number, scale: number, paper: boolean) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  oval(c, 0, 0, 21, 5, '#15142b55');
  const back = gait(travel, stride, 0.5), front = gait(travel, stride, 0);
  // The body rises over each stance foot; the feet stay on the ground beneath it.
  const bob = Math.abs(Math.sin(Math.PI * 2 * travel / stride)) * 2;
  c.translate(0, -bob);
  for (const [hip, foot, color] of [[8, back, '#1f2337'], [-9, front, '#252842']] as const) {
    const leg = solveLimb({ x: hip, y: -36 }, { x: hip + foot.x, y: bob - 8 - foot.lift }, 16, 16, 1);
    line(c, [[leg.root.x, leg.root.y], [leg.joint.x, leg.joint.y], [leg.end.x, leg.end.y]], color, 11);
    box(c, leg.end.x - 14, leg.end.y - 1, 22, 9, '#1c1c30', 3, 2);
  }
  box(c, -20, -80, 40, 49, NAVY, 9, 3);
  line(c, [[-20, -40], [20, -40]], '#1c1c30', 8);
  text(c, 'SEC', 0, -51, 13, BADGE, 'center', 34);
  line(c, [[-18, -71], [-37, -60], [-52, -75]], '#2e3a5c', 13);
  oval(c, -52, -75, 7, 7, '#d7a980', 2);
  if (paper) { c.save(); c.translate(-58, -86); c.rotate(-0.15); box(c, -12, -15, 22, 28, '#f7f1df', 2, 2); for (let i = 0; i < 4; i++) line(c, [[-8, -8 + i * 6], [6, -8 + i * 6]], '#9a8f7a', 1.5); c.restore(); }
  else { c.save(); c.translate(-56, -77); c.rotate(0.16); box(c, -25, -5, 29, 10, '#283145', 2, 2); box(c, -30, -8, 10, 16, '#95a6b1', 2, 2); c.restore(); }
  line(c, [[19, -70], [29, -48]], '#2e3a5c', 12); oval(c, 29, -43, 7, 8, '#d7a980', 2);
  oval(c, 0, -96, 19, 23, '#dbab80', 3);
  box(c, -19, -103, 27, 8, '#1b1f2e', 3, 1);
  line(c, [[-12, -84], [-2, -85]], '#483138', 3);
  shape(c, [[-20, -107], [-16, -121], [14, -122], [20, -107]], NAVY, 3);
  line(c, [[-19, -108], [-37, -105]], NAVY, 6);
  c.restore();
}

/** The raid, `age` seconds after the frozen beat: the SEC car, two agents, the flashlight and the tape, all in place by about 1.3 s. */
export function police(c: CanvasRenderingContext2D, age: number, reduced: boolean) {
  if (age < 0) return;
  const arrival = reduced ? 1 : ease(age / 0.55);
  const x = 1090 - arrival * 295;
  const shake = reduced || age > 1 ? 0 : Math.sin(age * 18) * 2 * (1 - clamp(age / 1));
  c.save(); c.translate(x, 422 + shake);
  oval(c, 0, 23, 117, 13, '#151b2e55');
  shape(c, [[-118, 6], [-109, -33], [-63, -48], [-37, -87], [45, -87], [84, -43], [115, -31], [121, 7]], '#2c3348', 5);
  shape(c, [[-59, -47], [-32, -80], [39, -80], [69, -47]], '#76aeb4', 4);
  line(c, [[6, -78], [6, -46]], INK, 5);
  box(c, -115, -29, 231, 28, BADGE, 3, 3);
  // SEC on the front door, clear of where the agents stop.
  text(c, 'SEC', -42, -6, 22, NAVY, 'center'); text(c, 'ENFORCEMENT', 62, -10, 9, NAVY, 'center');
  for (const wheel of [-73, 77]) { oval(c, wheel, 9, 24, 24, '#1d2130', 3); oval(c, wheel, 9, 12, 12, '#8e98a0', 3); }
  box(c, -34, -98, 61, 12, '#23344b', 3, 2);
  const red = reduced ? 0.8 : 0.45 + Math.sin(age * 7) * 0.35;
  c.globalAlpha = red; box(c, -31, -103, 27, 13, '#fa5c76', 4, 1);
  c.globalAlpha = reduced ? 0.8 : 0.9 - red; box(c, 1, -103, 23, 13, '#75c8ff', 4, 1); c.globalAlpha = 1;
  box(c, -115, -27, 17, 12, '#fff2ae', 2, 1);
  c.restore();
  if (age > 0.4 || reduced) {
    // The agents step out and walk in by distance: four steps for the first, three for the second.
    const approach = reduced ? 1 : ease((age - 0.5) / 0.85);
    c.save(); c.globalAlpha = reduced ? 1 : ease((age - 0.4) / 0.15);
    c.save(); c.globalAlpha *= reduced ? 0.14 : 0.1 + Math.sin(age * 1.4) * 0.025;
    // The beam leaves the first agent's flashlight lens and lands on Andy.
    shape(c, [[701 - approach * 101, 410], [201, 259], [192, 463]], '#fff4b9', 0); c.restore();
    agent(c, 774 - approach * 101, 480, approach * 101 / 0.85, 2 * 101 / 0.85 / 4, 0.85, false);
    agent(c, 897 - approach * 53, 475, approach * 53 / 0.78, 2 * 53 / 0.78 / 3, 0.78, true);
    c.restore();
  }
  if (age > 0.85 || reduced) {
    const reveal = reduced ? 1 : ease((age - 0.85) / 0.4);
    c.save(); c.translate(455, 497); c.rotate(-0.035); c.scale(reveal, 1);
    box(c, -290, -13, 650, 28, '#edd271', 0, 3);
    for (let i = 0; i < 18; i++) shape(c, [[-290 + i * 38, -13], [-277 + i * 38, -13], [-292 + i * 38, 15], [-305 + i * 38, 15]], '#252638', 0);
    box(c, -150, -12, 291, 26, '#f4da75', 0, 0); text(c, 'UNREGISTERED SECURITY', -4, 6, 15, '#fff2ba', 'center', 280); c.restore();
  }
}

/** A car's headlights cross the fence from the street: `at` is the beam's centre, `power` 0..1. */
export function headlights(c: CanvasRenderingContext2D, at: number, power: number) {
  if (power <= 0.01) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [dx, r, a] of [[0, 170, 0.32], [-36, 64, 0.5], [36, 64, 0.5]] as const) {
    const g = c.createRadialGradient(at + dx, 368, 4, at + dx, 368, r);
    g.addColorStop(0, `rgba(255, 244, 200, ${a * power})`); g.addColorStop(1, 'rgba(255, 244, 200, 0)');
    c.fillStyle = g; c.fillRect(at + dx - r, 368 - r, r * 2, r * 2);
  }
  c.restore();
}

/** Red and blue on the clouds beyond the fence: a siren somewhere down the street. */
export function sirenGlow(c: CanvasRenderingContext2D, age: number, power: number, reduced: boolean) {
  if (power <= 0.01) return;
  const swap = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(age * 16);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [x, color, k] of [[870, '255, 60, 95', swap], [955, '70, 140, 255', 1 - swap]] as const) {
    const g = c.createRadialGradient(x, 290, 4, x, 290, 175);
    g.addColorStop(0, `rgba(${color}, ${0.6 * power * k})`); g.addColorStop(1, `rgba(${color}, 0)`);
    c.fillStyle = g; c.fillRect(x - 175, 115, 350, 350);
  }
  c.restore();
}

/** A drone crossing the dusk with a searchlight; `x` is where it hovers, `sweep` where the beam lands. */
export function drone(c: CanvasRenderingContext2D, x: number, y: number, sweep: number, power: number, time: number, reduced: boolean) {
  if (power <= 0.01) return;
  c.save(); c.globalAlpha = power;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.16 * power;
  shape(c, [[x - 5, y + 9], [x + 5, y + 9], [sweep + 70, 486], [sweep - 70, 486]], '#fff4c4', 0); c.restore();
  line(c, [[x - 24, y - 2], [x + 24, y - 2]], '#30293d', 4);
  for (const dx of [-24, 24]) oval(c, x + dx, y - 6, reduced ? 12 : 4 + 9 * Math.abs(Math.sin(time * 40 + dx)), 2.5, '#5b5470aa');
  box(c, x - 13, y - 5, 26, 13, '#3b3550', 5, 2);
  oval(c, x, y + 10, 5, 4, '#fff6cf', 1.5);
  oval(c, x + 9, y - 1, 2.5, 2.5, (reduced || Math.sin(time * 9) > 0) ? '#ff5d72' : '#5a2833');
  c.restore();
}
